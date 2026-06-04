"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { type LucideIcon, ChevronLeft, ChevronRight, X, ChevronDown, Copy, FileText, Link2, Save, Check, BookOpen, Wand2, AlignLeft, Columns2, ArrowLeftRight, ArrowUpRight, Landmark, Eye, Tag, Search, SlidersHorizontal, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OT_BOOK_ORDER, NT_BOOK_ORDER, BOOK_ORDER, BOOK_NAMES,
  decodeMorph, normalizePosKey, type MorphRow,
  decodeHebrewMorph, normalizeHebrewPosKey, type HebrewMorphRow,
} from "./utils";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import { useAuthContext } from "@/components/AuthProvider";

/* ── Window type augmentation ───────────────────────────────── */
declare global {
  interface Window {
    RhemaNT?: { books: string[]; names: Record<string,string>; text: Record<string,Record<string,Record<string,Array<[string,number,string]>>>> };
    RhemaCriticalNT?: { text: Record<string,Record<string,Record<string,Array<[string,number,string]>>>> };
    RhemaLXX?: { books: string[]; names: Record<string,string>; text: Record<string,Record<string,Record<string,Array<[string,number,string]>>>> };
    RhemaLexicon?: Record<number, LexEntry>;
    RhemaMSB?: Record<string,Record<string,Record<string,string>>>;
    RhemaBSB?: Record<string,Record<string,Record<string,string>>>;
    RhemaMM?: Record<string,Record<string,Record<string,Array<[string,number,string]>>>>;
    RhemaMSBBooks?: string[];
    RhemaBSBBooks?: string[];
    RhemaCrossRefs?: Record<string, Record<string, string[]>>;
    RhemaCrossRefLabels?: string[];
    RhemaSyntax?: Record<string, Record<string, Record<string, Array<[number, number, string]>>>>;
    /* Hebrew */
    RhemaHebrewOT?: { books: string[]; names: Record<string,string>; text: Record<string,Record<string,Record<string,Array<[string,number,string]>>>> };
    RhemaHebrewLexicon?: Record<number, HebrewLexEntry>;
  }
}

/* ── Syntax types ────────────────────────────────────────────── */
interface SxCat { i: number; surface: string; strongs: number; morph: string; pos: string; cng: { case: string; number: string; gender: string | null } | null; vtype: 'finite' | 'participle' | 'infinitive' | null }
interface SxPhrase { type: string; role: string; label: string; plainLabel?: string; color: string; words: number[]; isMainVerb?: boolean; isDep?: boolean; clauseType?: string; fromDataset?: boolean; prepStrongs?: number; prepObjCase?: string | null; artCase?: string }
interface SxClause { clauseType: string; label: string; conjPhrase: SxPhrase | null; phrases: SxPhrase[]; isSubordinate: boolean; children: SxClause[] }

interface LexEntry {
  lemma?: string;
  translit?: string;
  brief?: string;
  extended?: string;
  quick_def?: string;
  abbott_smith?: string;
  moulton_milligan?: string;
  strongs_def?: string;
  kjv_def?: string;
  deriv?: string;
}

interface HebrewLexEntry {
  lemma?: string;
  translit?: string;
  pronounce?: string;
  brief?: string;
  quick_def?: string;
  extended?: string;
  strongs_def?: string;
  kjv_def?: string;
  deriv?: string;
}

type Word = [string, number, string]; // [surface, strongs, morph]
type TextMode = "majority" | "critical";
type ActiveTab = "parsing" | "definition" | "occurrences" | "note";

const STORAGE_BASE =
  "https://firebasestorage.googleapis.com/v0/b/disciple-preparer.firebasestorage.app/o/rhema%2F";

const DATA_FILES_CORE = [
  "rhema-nt.js", "rhema-critical.js", "rhema-lxx.js",
  "rhema-lexicon.js", "rhema-mm.js", "rhema-msb.js",
  "rhema-bsb.js", "rhema-syntax.js", "rhema-crossrefs.js",
];
const HEBREW_BASE = "/rhema/";
const DATA_FILES_HEBREW = ["rhema-ot-hebrew.js", "rhema-hebrew-lexicon.js"];

const CROSS_REF_LABELS: Record<string, string> = {
  d: "Direct References", t: "Same Book", o: "Related",
  n: "NT Connection", f: "OT Foundation", p: "Typology & Prophecy",
  a: "Parallel", e: "Theme",
};

/* Each POS category: label + Tailwind color classes */
const CATEGORY_CONFIG: Record<string, { label: string; text: string; bg: string; border: string; dot: string }> = {
  V:    { label: "Verbs",        text: "text-orange-400",  bg: "bg-orange-500/15",  border: "border-orange-500/50",  dot: "bg-orange-400" },
  N:    { label: "Nouns",        text: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/50",    dot: "bg-blue-400" },
  ADJ:  { label: "Adjectives",   text: "text-purple-400",  bg: "bg-purple-500/15",  border: "border-purple-500/50",  dot: "bg-purple-400" },
  PRON: { label: "Pronouns",     text: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/50",     dot: "bg-red-400" },
  T:    { label: "Articles",     text: "text-gray-400",    bg: "bg-gray-500/15",    border: "border-gray-500/50",    dot: "bg-gray-400" },
  CONJ: { label: "Conjunctions", text: "text-green-400",   bg: "bg-green-500/15",   border: "border-green-500/50",   dot: "bg-green-400" },
  PREP: { label: "Prepositions", text: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/50",    dot: "bg-rose-400" },
  ADV:  { label: "Adverbs",      text: "text-teal-400",    bg: "bg-teal-500/15",    border: "border-teal-500/50",    dot: "bg-teal-400" },
  PART: { label: "Particles",    text: "text-yellow-400",  bg: "bg-yellow-500/15",  border: "border-yellow-500/50",  dot: "bg-yellow-400" },
};

/* Hebrew POS categories */
const HEBREW_CATEGORY_CONFIG: Record<string, { label: string; text: string; bg: string; border: string; dot: string }> = {
  V:  { label: "Verbs",        text: "text-orange-400",  bg: "bg-orange-500/15",  border: "border-orange-500/50",  dot: "bg-orange-400" },
  N:  { label: "Nouns",        text: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/50",    dot: "bg-blue-400" },
  Np: { label: "Proper Nouns", text: "text-sky-400",     bg: "bg-sky-500/15",     border: "border-sky-500/50",     dot: "bg-sky-400" },
  A:  { label: "Adjectives",   text: "text-purple-400",  bg: "bg-purple-500/15",  border: "border-purple-500/50",  dot: "bg-purple-400" },
  P:  { label: "Pronouns",     text: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/50",     dot: "bg-red-400" },
  R:  { label: "Prepositions", text: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/50",    dot: "bg-rose-400" },
  C:  { label: "Conjunctions", text: "text-green-400",   bg: "bg-green-500/15",   border: "border-green-500/50",   dot: "bg-green-400" },
  D:  { label: "Adverbs",      text: "text-teal-400",    bg: "bg-teal-500/15",    border: "border-teal-500/50",    dot: "bg-teal-400" },
  T:  { label: "Particles",    text: "text-yellow-400",  bg: "bg-yellow-500/15",  border: "border-yellow-500/50",  dot: "bg-yellow-400" },
  S:  { label: "Suffixes",     text: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/50",   dot: "bg-amber-400" },
};

/* ── Book study data ────────────────────────────────────────── */
const BOOK_GENRE: Record<string, string> = {
  GEN:"narrative", EXO:"law",      LEV:"law",      NUM:"narrative", DEU:"law",
  JOS:"history",  JDG:"history",  RUT:"history",
  "1SA":"history","2SA":"history","1KI":"history","2KI":"history",
  "1CH":"history","2CH":"history",EZR:"history",  NEH:"history",  EST:"history",
  JOB:"wisdom",   PSA:"poetry",   PRO:"wisdom",   ECC:"wisdom",   SNG:"poetry",
  ISA:"prophecy", JER:"prophecy", LAM:"poetry",   EZK:"prophecy", DAN:"apocalyptic",
  HOS:"prophecy", JOL:"prophecy", AMO:"prophecy", OBA:"prophecy", JON:"narrative",
  MIC:"prophecy", NAM:"prophecy", HAB:"prophecy", ZEP:"prophecy", HAG:"prophecy",
  ZEC:"prophecy", MAL:"prophecy",
  MAT:"gospel",   MAR:"gospel",   LUK:"gospel",   JOH:"gospel",   ACT:"history",
  ROM:"epistle",  "1CO":"epistle","2CO":"epistle", GAL:"epistle",  EPH:"epistle",
  PHP:"epistle",  COL:"epistle",  "1TH":"epistle","2TH":"epistle",
  "1TI":"epistle","2TI":"epistle",TIT:"epistle",  PHM:"epistle",
  HEB:"epistle",  JAM:"epistle",
  "1PE":"epistle","2PE":"epistle","1JO":"epistle","2JO":"epistle","3JO":"epistle",
  JUD:"epistle",  REV:"apocalyptic",
};

const GENRE_COLOR: Record<string, string> = {
  narrative:   "bg-amber-500/10   text-amber-400   border-amber-500/30",
  law:         "bg-red-500/10     text-red-400     border-red-500/30",
  history:     "bg-orange-500/10  text-orange-400  border-orange-500/30",
  wisdom:      "bg-teal-500/10    text-teal-400    border-teal-500/30",
  poetry:      "bg-purple-500/10  text-purple-400  border-purple-500/30",
  prophecy:    "bg-blue-500/10    text-blue-400    border-blue-500/30",
  apocalyptic: "bg-rose-500/10    text-rose-400    border-rose-500/30",
  gospel:      "bg-green-500/10   text-green-400   border-green-500/30",
  epistle:     "bg-indigo-500/10  text-indigo-400  border-indigo-500/30",
};

const GENRE_PROMPTS: Record<string, string[]> = {
  narrative:   ["Who acts and who is acted upon?", "What does God do here?", "What is the conflict or tension?", "What is the setting, and does it matter?"],
  law:         ["Who is addressed?", "What action is required or prohibited?", "What reason or consequence is given?", "Moral, ceremonial, or civil?"],
  history:     ["What is the turning point?", "What caused this event?", "What does the author emphasize?", "What is the human failure or faithfulness?"],
  wisdom:      ["What contrast is being drawn?", "What repeated word or image appears?", "Who benefits from following this?", "What assumption underlies this?"],
  poetry:      ["What is the dominant emotion?", "What images are used?", "What type of parallelism is present?", "What does the speaker ask of God?"],
  prophecy:    ["What is the historical situation?", "Is this promise, warning, or both?", "Who is the audience?", "Near and far fulfillment?"],
  gospel:      ["What does Jesus say and do?", "Who is present and how do they respond?", "What OT passage does this echo?", "What does this reveal about who Jesus is?"],
  epistle:     ["What indicatives (truths) are stated?", "What imperatives (commands) follow?", "What is the logical argument?", "Who is the specific audience?"],
  apocalyptic: ["What symbols are used?", "What OT imagery appears?", "What contrast is being drawn?", "What is the main message of hope or warning?"],
};

const BOOK_CONTEXT: Record<string, string> = {
  GEN: "Written during or shortly after Moses' time (~1446–1400 BC). Genesis addresses Israel's origins before Sinai and engages — while reframing — ancient Near Eastern creation and flood traditions. Patriarchal customs mirror 2nd-millennium BC texts from Nuzi and Mari.",
  EXO: "Set in Egypt's New Kingdom period (~1450 or ~1290 BC, debated). The tabernacle instructions mirror ancient suzerainty treaty structures. The ten plagues systematically challenge Egyptian deities by name.",
  LEV: "A priestly handbook given at Sinai. The sacrificial system is not primitive ritual — it is a theologically ordered statement about holiness, atonement, and covenant access. Parallels exist in surrounding cultures but with distinctive theological warrants.",
  NUM: "Records approximately 38 years between Sinai and Canaan. Structured around two military censuses. The older generation's death in the wilderness (due to unbelief at Kadesh-Barnea) is the narrative's theological hinge.",
  DEU: "Moses' final speeches on the plains of Moab (~1406 BC). Structured like a Hittite suzerainty treaty (preamble, history, stipulations, blessings/curses, succession). It restates and applies the law for the Canaan-entering generation.",
  JOS: "Covers the conquest and settlement of Canaan under Joshua (~1406–1380 BC). Archaeological evidence at Jericho and Hazor correlates with some accounts. Covenant faithfulness is the consistent condition for military success.",
  JDG: "Approximately 350 years of apostasy, oppression, repentance, and deliverance (~1380–1050 BC). Judges were regional military deliverers, not national rulers. The book progressively demonstrates societal collapse when everyone does 'what is right in his own eyes.'",
  RUT: "A counter-narrative of faithfulness set during the period of the Judges. The kinsman-redeemer (go'el) institution is the cultural and legal centerpiece. Ruth the Moabite becomes an ancestor of David and Christ (Matt 1:5).",
  "1SA": "Covers Israel's transition from judges to monarchy (~1050–970 BC). Samuel is simultaneously the last major judge and a pivotal prophet. Saul's failure demonstrates the danger of kingship on human terms; David's anointing introduces the messianic covenant line.",
  "2SA": "Chronicles David's reign over all Israel (~1010–970 BC). The Davidic covenant (ch. 7) is foundational to biblical messianism. David's moral failure with Bathsheba and its family consequences occupy nearly half the book.",
  "1KI": "Covers Solomon's reign and the divided monarchy (~970–852 BC). Solomon's wisdom, temple construction, and eventual apostasy through foreign marriages dominate the first half. The north-south division follows his death.",
  "2KI": "Continues through Israel's fall to Assyria (722 BC) and Judah's fall to Babylon (586 BC). Both deportations are explicitly interpreted as covenant judgment for persistent idolatry.",
  "1CH": "A genealogical-priestly history compiled during or after the exile, emphasizing David's preparation for the temple, priestly organization, and proper worship. Military failures visible in Samuel-Kings are sometimes omitted to highlight faithfulness.",
  "2CH": "Covers Solomon through Jerusalem's fall, centering on temple worship and righteous-king narratives. The northern kingdom receives minimal attention. Ends with Cyrus's return decree, directly connecting to Ezra.",
  EZR: "Records two returns from Babylon under Zerubbabel (~538 BC) and Ezra (~458 BC). Ezra was a skilled scribe in the Mosaic law. The book addresses temple rebuilding and the community's struggle with assimilation through intermarriage. Written in both Hebrew and Aramaic.",
  NEH: "Nehemiah was a Persian royal cupbearer — a position of high trust — who served as governor of Judah (~445 BC). Combines prayer, practical organization, and confrontation of external opponents to rebuild Jerusalem's walls.",
  EST: "Set in the Persian court of Xerxes I (~480 BC). God's name never appears, yet his providential care is evident throughout. The Feast of Purim celebrates Jewish survival in diaspora. The book addresses identity and faithfulness under imperial pressure.",
  JOB: "The setting is pre-Mosaic or non-Israelite (Job is from Uz, likely Edomite territory). The most sustained biblical engagement with innocent suffering. The prose framework and poetic dialogues likely represent intentionally combined literary traditions.",
  PSA: "150 poems spanning ~1000 years (Moses to post-exile). Five books mirror the Pentateuch. Major genres include lament (the largest), praise, royal, wisdom, and torah psalms. Lament psalms model honest prayer that moves from complaint to trust.",
  PRO: "Wisdom literature from Solomon's court (~950 BC) with later additions. Proverbs are generalizations — tendencies about how the world works — not universal guarantees. 'Fear of the LORD' is the foundational epistemology (1:7). The personification of Wisdom in chapters 1–9 has messianic resonances.",
  ECC: "A wisdom investigation into meaning 'under the sun' (apart from God's perspective), associated with Solomon. The persistent 'vanity' (hebel = vapor) reaches resolution in the epilogue: fear God and keep his commandments. The book tests human wisdom to its limits.",
  SNG: "Love poetry connected to Solomon's court. Celebrates human sexuality within covenant marriage. The book's canonical status was debated in Jewish tradition; Rabbi Akiba famously defended it. Some interpreters also see allegorical resonance with God's covenant love.",
  ISA: "Isaiah of Jerusalem prophesied ~740–680 BC. Chapters 1–39 focus on judgment and near-term hope; chapters 40–66 emphasize comfort and restoration. The Servant Songs (42, 49, 50, 52–53) are pivotal for messianic interpretation. The NT quotes Isaiah more than any other OT prophet.",
  JER: "Jeremiah prophesied in Judah from Josiah's reign through Jerusalem's fall (~627–580 BC). He was forbidden to marry as a sign of coming devastation. The New Covenant promise (ch. 31) is the longest messianic passage in the OT. The book is chronologically disordered by design.",
  LAM: "Five acrostic poems (each following the Hebrew alphabet) lamenting Jerusalem's destruction (586 BC), traditionally attributed to Jeremiah. The book gives language to communal trauma and models unresolved grief before God, without forcing premature resolution.",
  EZK: "Ezekiel prophesied from Babylon during the exile (~593–571 BC). His priestly background shapes the book's concern with purity, the sanctuary, and God's holiness. The 'glory of the LORD' departing from Jerusalem and later returning is the book's central theological arc.",
  DAN: "Daniel served in Babylonian and Persian courts (~605–530 BC). Chapters 1–6 are court narratives; chapters 7–12 are apocalyptic visions. The 'son of man' vision (ch. 7) is foundational to Jesus' self-designation. The symbolic imagery assures the faithful of God's ultimate sovereignty over all empires.",
  HOS: "Hosea prophesied to northern Israel ~760–720 BC, just before Assyrian conquest. His marriage to the unfaithful Gomer is a living parable of God's covenant with idolatrous Israel. The themes of covenant faithfulness (hesed) and spiritual adultery are central.",
  JOL: "Joel's date is debated (pre-exilic to post-exilic). A devastating locust plague becomes both a call to repentance and a lens for describing the coming 'Day of the LORD.' The Spirit-pouring promise (2:28–29) is cited by Peter at Pentecost (Acts 2).",
  AMO: "Amos prophesied to prosperous northern Israel ~760 BC (under Jeroboam II). He was a shepherd and sycamore farmer from Tekoa in Judah — an outsider. He relentlessly denounces injustice, corrupt worship, and false security built on economic prosperity.",
  OBA: "The shortest OT book, a single chapter of judgment against Edom for rejoicing over Jerusalem's fall. Edom (descendants of Esau) represents recurring opposition to God's people. Likely post-587 BC.",
  JON: "A narrative about a reluctant prophet, not a collection of oracles. The fish episode is only three verses; the theological center is God's concern for Nineveh (Israel's hated enemy) and Jonah's resistance to that mercy. Jesus cited it as a sign of his death and resurrection (Matt 12:40).",
  MIC: "A contemporary of Isaiah and Hosea (~735–700 BC), Micah was a rural prophet who challenged urban corruption and false prophecy. The Bethlehem-ruler promise (5:2) is cited at Jesus' birth (Matt 2:6).",
  NAM: "A declaration of Nineveh's fall ~100 years after Jonah's preaching there (~650 BC). Unlike Jonah, there is no call to repentance — Assyria's brutality has reached a point of judgment. Nahum demonstrates God's power to judge the world's cruelest empire.",
  HAB: "A prophetic dialogue (~605 BC) where Habakkuk questions God about injustice and receives an unexpected answer: Babylon will be God's instrument. The statement 'the righteous shall live by his faith' (2:4) is cited in Romans 1:17, Galatians 3:11, and Hebrews 10:38.",
  ZEP: "Prophesied under Josiah (~630–620 BC), just before his great revival. A descendant of Hezekiah, Zephaniah proclaims universal and national judgment ('the Day of the LORD') followed by the promised restoration of a humble remnant.",
  HAG: "Two months of prophecy in 520 BC, after the return from Babylon. Haggai rebukes the returned exiles for building their own houses while the temple lay unfinished. Temple work resumes within three weeks. He is among the most immediately effective prophets in Scripture.",
  ZEC: "Prophesied alongside Haggai (~520–480 BC). Chapters 1–8 feature eight night visions encouraging the restored community; chapters 9–14 shift to prophetic oracles with strong messianic content. The NT quotes Zechariah more than any OT book except Isaiah and Psalms.",
  MAL: "The last OT prophet (~430–400 BC), addressing a post-exilic community grown disillusioned and careless. The disputational style ('You say…' / 'But I say…') confronts defiled offerings, divorce, and withheld tithes. The book closes pointing to the coming of Elijah — fulfilled in John the Baptist.",
  MAT: "Written primarily for a Jewish audience, presenting Jesus as the fulfillment of OT Scripture and the Davidic Messiah. Matthew quotes or alludes to the OT ~130 times. Structured around five major discourses paralleling the Pentateuch. Written ~50–70 AD.",
  MAR: "The shortest and likely earliest Gospel (~45–68 AD), traditionally connected to Peter. Emphasizes action ('immediately' appears ~41 times). Written for a Gentile (likely Roman) audience — Jewish customs are explained. Jesus' identity is revealed progressively, reaching full confession at the cross.",
  LUK: "Written by Luke (a Gentile physician, Paul's companion) as part one of Luke–Acts. Emphasizes Jesus' concern for the marginalized: women, Samaritans, sinners, the poor. Has the most extensive birth narrative of any Gospel. Written ~60–80 AD, using Mark and additional sources.",
  JOH: "The most theologically distinct Gospel, written ~85–100 AD. Organized around seven signs and seven 'I Am' statements. John explicitly states his purpose: 'these are written that you may believe that Jesus is the Christ, the Son of God, and that by believing you may have life in his name' (20:31). Faith alone is the instrument of eternal life.",
  ACT: "Volume 2 of Luke's work, covering the spread of the church from Jerusalem to Rome (~30–62 AD). Structured around geographical and ethnic expansion: Jerusalem → Judea/Samaria → the ends of the earth. Records Paul's three missionary journeys and the gospel's movement from synagogue to empire.",
  ROM: "Paul's most systematic theological letter, written ~57 AD before his planned visit to Rome. The argument moves from universal condemnation (1–3) to justification by faith (3–5) to sanctification (6–8) to Israel's future (9–11) to community life (12–16). The thesis: God's righteousness is revealed through faith (1:16–17).",
  "1CO": "Written ~55 AD to a diverse, divided church in prosperous Corinth. Addresses factionalism, sexual ethics, idol food, spiritual gifts, the Lord's Supper, and the resurrection. Corinth's reputation for philosophical debate and moral laxity provides the backdrop for nearly every issue Paul addresses.",
  "2CO": "Paul's most personal letter, written ~56 AD partly defending his apostolic authority against 'super-apostles.' The theology of suffering, weakness, and God's sufficient grace is central. Paul's collection for Jerusalem and the question of false teachers drive much of the argument.",
  GAL: "Written ~48 AD (among the earliest NT letters) to churches being pressured to add circumcision and Torah to faith for justification. Paul's response is sharp: this is 'a different gospel — which is not a gospel at all.' Justification is by faith alone, apart from works of the law.",
  EPH: "Written from prison (~60–62 AD), likely circulated as a general letter. Chapters 1–3 are doctrinal (grace, the mystery of Gentile inclusion, unity in Christ); chapters 4–6 are practical (community ethics, household codes, spiritual warfare). The cosmic scope of Christ's lordship is the foundation.",
  PHP: "A letter of joy from prison (~60–62 AD) to Paul's first European church plant (Philippi, Acts 16). The 'kenosis hymn' (2:5–11) is one of the most important Christological passages in the NT. Addresses anxiety, contentment, false teachers, and the pursuit of knowing Christ.",
  COL: "Written from prison (~60–62 AD) to address an early false teaching combining Jewish regulations with cosmic philosophy. The supremacy of Christ over all powers and principalities is the theological corrective. The most compact household code in Paul (3:18–4:1).",
  "1TH": "Paul's earliest surviving letter (~50–51 AD), written to a new church that faced persecution. Affirms their faith, defends Paul's conduct, addresses sexual purity, and answers questions about believers who have died before Christ's return (4:13–5:11).",
  "2TH": "Written shortly after 1 Thessalonians to address confusion: the 'Day of the Lord' has not already come. Paul describes events that must precede it ('the man of lawlessness'). Also confronts idleness in the community.",
  "1TI": "A pastoral letter to Timothy in Ephesus (~63–65 AD). Addresses false teaching, prayer, qualifications for church leaders, care for widows and elders, and Timothy's personal godliness. The 'faithful sayings' (1:15; 3:1; 4:9) mark key theological affirmations.",
  "2TI": "Paul's final letter from Roman imprisonment (~66–67 AD) before his execution. A charge to Timothy to remain faithful, preach the word, and guard the gospel amid opposition. The inspiration of Scripture (3:16–17) and the transmission of sound teaching (2:2) are foundational passages.",
  TIT: "A pastoral letter to Titus in Crete (~63–65 AD). Addresses elder qualifications, behavior of different groups in the church, and the relationship between grace and good works. The Cretan cultural context shapes some of the instruction's directness.",
  PHM: "The shortest of Paul's letters (~55–60 AD), a personal appeal regarding Onesimus — a runaway slave who became a believer. Paul uses legal obligation and family language to request Onesimus's freedom. A case study in the social implications of the gospel without direct command.",
  HEB: "Author unknown (proposals include Apollos, Barnabas, Priscilla), written before 70 AD to Jewish believers tempted to return to Judaism. Central argument: Jesus is superior to angels, Moses, the Levitical priesthood, and the old covenant. Five solemn warning passages call readers to persevere in faith.",
  JAM: "Written by James (the Lord's brother) ~49 AD, one of the earliest NT letters, to Jewish believers in diaspora. Practical wisdom literature addressing the relationship between faith and works — not for justification before God, but as evidence of genuine faith in community. James and Paul use 'justify' in different senses.",
  "1PE": "Written ~64–65 AD to believers across Asia Minor facing Nero-era pressure. Addresses how to live as 'elect exiles' — those whose true citizenship is elsewhere. Suffering is reframed as participation in Christ's experience. Household codes address behavior under social vulnerability.",
  "2PE": "Written shortly before Peter's death (~66–68 AD). Addresses false teachers who distort Paul's writings and deny Christ's return. The authority of apostolic eyewitness vs. 'cleverly devised myths' is a central concern. Chapter 3 on the Day of the Lord and new creation is eschatologically significant.",
  "1JO": "Written by the Apostle John (~90–95 AD) to counter Docetic Gnosticism (which denied Christ's physical incarnation). The letter's tests of fellowship with God — walking in light, loving one another, confessing the Incarnation — are tests of community health, not the basis of assurance of eternal salvation.",
  "2JO": "A brief letter from John to 'the elect lady and her children' (likely a local church). Warns against welcoming teachers who deny the Incarnation. The command to love and the warning about deception frame a pointed practical letter.",
  "3JO": "A brief personal letter commending Gaius for supporting traveling missionaries and rebuking Diotrephes for self-promotion. A window into early church polity conflicts and the importance of hospitality to itinerant teachers.",
  JUD: "A short letter from Jude (the Lord's brother) to combat false teachers who turned grace into a license for immorality. Uses OT examples (Sodom, Cain, Balaam, Korah) to describe the danger. The doxology (vv. 24–25) is among the most praised in the NT.",
  REV: "Apocalyptic visions received by John on Patmos during Domitian's reign (~95 AD). Written to seven real historical churches under imperial pressure. Uses symbolic imagery drawn from Daniel, Ezekiel, Isaiah, and Zechariah. The main message: Christ is victorious, his people will endure, and God will judge the nations.",
};

const STUDY_THEMES = [
  "Faith", "Salvation", "Justification", "Sanctification", "Eternal Life",
  "Grace", "Atonement", "Sacrifice", "Forgiveness", "Repentance",
  "Covenant", "Law", "Promise", "Fulfillment", "Prophecy",
  "Kingdom", "Messiah", "Resurrection", "Holy Spirit", "Trinity",
  "Prayer", "Worship", "Obedience", "Discipleship", "Rewards",
  "Suffering", "Judgment", "Wrath", "Mercy", "Righteousness",
  "Creation", "Providence", "Israel", "Church", "Mission",
  "Love", "Hope", "Peace", "Wisdom", "Word of God",
];

/* ── Data helpers ───────────────────────────────────────────── */
function getBibleData() {
  if (!window.RhemaNT) return null;
  const lxx = window.RhemaLXX || { books: [], names: {}, text: {} };
  return {
    books: [...(lxx.books || []), ...(window.RhemaNT.books || NT_BOOK_ORDER)],
    names: { ...(lxx.names || {}), ...(window.RhemaNT.names || {}) },
    text: { ...(lxx.text || {}), ...(window.RhemaNT.text || {}) },
  };
}

function getText(mode: TextMode) {
  const base = getBibleData()?.text || {};
  if (mode === "critical" && window.RhemaCriticalNT?.text) {
    return { ...base, ...window.RhemaCriticalNT.text };
  }
  return base;
}

function getWords(book: string, ch: string, v: string, mode: TextMode, hebrew = false): Word[] {
  if (hebrew && isOTBook(book) && window.RhemaHebrewOT) {
    return window.RhemaHebrewOT.text[book]?.[ch]?.[v] || [];
  }
  return getText(mode)[book]?.[ch]?.[v] || [];
}

function getEnglishText(book: string, ch: string, v: string, mode: TextMode): string {
  const src = mode === "critical" ? window.RhemaBSB : window.RhemaMSB;
  return src?.[book]?.[String(ch)]?.[String(v)] || "";
}

function getEnglishLabel(mode: TextMode) {
  return mode === "critical" ? "BSB" : "MSB";
}

function getBookOrder(mode: TextMode, hebrew = false): string[] {
  if (hebrew && window.RhemaHebrewOT) {
    const ntText = getText(mode);
    const otBooks = OT_BOOK_ORDER.filter(b => window.RhemaHebrewOT!.text[b]);
    const ntBooks = NT_BOOK_ORDER.filter(b => ntText[b]);
    return [...otBooks, ...ntBooks];
  }
  const text = getText(mode);
  return BOOK_ORDER.filter(c => text[c]);
}

function getChapters(book: string, mode: TextMode, hebrew = false): string[] {
  if (hebrew && isOTBook(book) && window.RhemaHebrewOT) {
    const chObj = window.RhemaHebrewOT.text[book] || {};
    return Object.keys(chObj).sort((a, b) => Number(a) - Number(b));
  }
  const chObj = getText(mode)[book] || {};
  return Object.keys(chObj).sort((a, b) => Number(a) - Number(b));
}

function getVerses(book: string, ch: string, mode: TextMode, hebrew = false): string[] {
  if (hebrew && isOTBook(book) && window.RhemaHebrewOT) {
    const vObj = window.RhemaHebrewOT.text[book]?.[ch] || {};
    return Object.keys(vObj).sort((a, b) => Number(a) - Number(b));
  }
  const vObj = getText(mode)[book]?.[ch] || {};
  return Object.keys(vObj).sort((a, b) => Number(a) - Number(b));
}

function getLex(strongs: number): LexEntry {
  return (window.RhemaLexicon || {})[strongs] || {};
}

function getHebrewLex(strongs: number): HebrewLexEntry {
  return (window.RhemaHebrewLexicon || {})[strongs] || {};
}

function isOTBook(book: string): boolean {
  return OT_BOOK_ORDER.includes(book);
}

function hebrewAvailable(): boolean {
  return !!(window.RhemaHebrewOT && window.RhemaHebrewLexicon);
}

function getQuickDef(lex: LexEntry): string {
  const src = lex.quick_def || lex.brief || lex.extended || lex.strongs_def || lex.kjv_def || "";
  const plain = src.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim().replace(/^--\s*/, "");
  if (!plain) return "";
  const first = plain.split(/(?:;|\.)\s+/)[0].trim();
  const ans = first || plain;
  return ans.length > 150 ? ans.slice(0, 147) + "..." : ans;
}

/* ── English verb form helpers (ported from Greek-Vocab source) ── */
function engIng(v: string): string {
  if (!v) return v;
  if (/[^aeiou]e$/.test(v)) return v.slice(0, -1) + "ing";
  return v + "ing";
}
function engPast(v: string): string {
  if (!v) return v;
  if (/e$/.test(v)) return v + "d";
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ied";
  return v + "ed";
}
function eng3sg(v: string): string {
  if (!v) return v;
  if (/(?:s|sh|ch|x|z)$/.test(v)) return v + "es";
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies";
  return v + "s";
}
function engPlural(v: string): string {
  if (!v) return v;
  if (/(?:s|sh|ch|x|z)$/.test(v)) return v + "es";
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies";
  if (/fe?$/.test(v)) return v.replace(/fe?$/, "ves");
  return v + "s";
}

/* Inflected gloss for verbs: "he / she loves", "to love", "loving", "having loved", "love!" */
function verbGloss(morph: string, brief: string): string {
  const base = brief.split(",")[0].split(";")[0].trim().replace(/^I /, "").trim();
  if (!base) return "";
  if (!morph || !morph.startsWith("V-")) return base;
  const parts = morph.split("-");
  const form = (parts[1] || "").replace(/^2/, "");
  const persNum = parts[2] || "";
  const tense = form[0], voice = form[1], mood = form[form.length - 1];
  if (mood === "N") return `to ${base}`;
  if (mood === "P")
    return tense === "A" || tense === "X" || tense === "Y"
      ? `having ${engPast(base)}`
      : engIng(base);
  const pn = persNum.match(/^([123])([SP])/);
  if (!pn) return base;
  const [, pers, num] = pn;
  const SUBJ: Record<string, string> = {
    "1S": "I", "2S": "you", "3S": "he / she", "1P": "we", "2P": "you all", "3P": "they",
  };
  const subj = SUBJ[`${pers}${num}`] || "";
  const modal = mood === "S" || mood === "O" ? " might" : "";
  if (mood === "M") return `${base}!`;
  if (base === "am" || base === "be") {
    const BE: Record<string, string> = { "1S": "am", "2S": "are", "3S": "is", "1P": "are", "2P": "are", "3P": "are" };
    const beF = BE[`${pers}${num}`] || "are";
    return modal ? `${subj} might ${beF}` : `${subj} ${beF}`;
  }
  const conjugated = voice === "P"
    ? `be ${base}`
    : pers === "3" && num === "S" && !modal
      ? eng3sg(base.split(" ")[0]) + (base.includes(" ") ? base.slice(base.indexOf(" ")) : "")
      : base;
  return subj ? `${subj}${modal} ${conjugated}` : `${modal.trim()} ${conjugated}`.trim();
}

/* Case-inflected gloss for nouns/pronouns/adjectives: "of God", "to/for God", "words" */
function nounGloss(morph: string, brief: string): string {
  const base = brief.split(",")[0].split(";")[0].trim();
  if (!base || !morph) return base;
  const segs = morph.split("-");
  const posRaw = segs[0];
  if (posRaw === "T") return base;
  const cng = segs[1] || "";
  if (!cng) return base;
  if (["PRI", "NUI", "LI", "OI"].includes(cng)) return base;
  let caseCode: string;
  let numberCode = "";
  if (posRaw === "P") {
    caseCode = cng[0] === "1" || cng[0] === "2" ? cng[1] : cng[0];
  } else if (posRaw === "F") {
    caseCode = cng[1];
    numberCode = cng[2] || "";
  } else if (posRaw === "S") {
    caseCode = cng[2];
  } else {
    caseCode = cng[0];
    numberCode = cng[1] || "";
  }
  const isPlural = numberCode === "P";
  const firstWord = base.split(" ")[0];
  const rest = base.includes(" ") ? base.slice(base.indexOf(" ")) : "";
  const displayBase = isPlural ? engPlural(firstWord) + rest : base;
  const CASE_PREP: Record<string, string> = { N: "", G: "of ", D: "to/for ", A: "", V: "O " };
  const prep = CASE_PREP[caseCode];
  if (prep === undefined) return displayBase;
  return prep ? `${prep}${displayBase}` : displayBase;
}

/* Unified word gloss: routes to verb or noun function based on morph code */
function getWordGloss(lex: LexEntry, morph: string): string {
  const brief = (lex.brief || lex.quick_def || "").replace(/<[^>]+>/g, "").trim();
  if (!brief) return "";
  if (morph.startsWith("V-")) return verbGloss(morph, brief);
  return nounGloss(morph, brief);
}

/* Hebrew inflected gloss: construct → "of X", plural → "Xs", perfect/imperfect → "he/she Xed" */
function getHebrewWordGloss(lex: HebrewLexEntry, morph: string): string {
  const src = lex.brief || lex.kjv_def || lex.strongs_def || "";
  const base = src.replace(/<[^>]+>/g, "").split(/[,;]/)[0].trim().replace(/^to /, "").trim();
  if (!base || !morph) return base;
  // Strip H prefix + compound prefix (e.g. "HVqp3ms" → "Vqp3ms", "HR/Ncfsa" → "Ncfsa")
  let m = morph.startsWith("H") ? morph.slice(1) : morph;
  if (m.includes("/")) m = m.split("/").pop()!;
  const pos = m[0];
  if (pos === "V") {
    const form = m[2] || "";
    const person = m[3] || "";
    const gender = m[4] || "";
    const number = m[5] || "";
    if (form === "c" || form === "a") return `to ${base}`;
    if (form === "r") return engIng(base);
    if (form === "s") return `${engIng(base)} (pass.)`;
    if (form === "v") return `${base}!`;
    const SUBJ: Record<string, string> = {
      "1ms": "I", "1fs": "I", "1cs": "I",
      "1mp": "we", "1fp": "we", "1cp": "we",
      "2ms": "you", "2fs": "you", "2mp": "you all", "2fp": "you all",
      "3ms": "he", "3fs": "she", "3cs": "he/she",
      "3mp": "they", "3fp": "they", "3cp": "they",
    };
    const subj = SUBJ[`${person}${gender}${number}`] || "";
    if (form === "p" || form === "w") return subj ? `${subj} ${engPast(base)}` : engPast(base);
    if (form === "q") return subj ? `${subj} will ${base}` : `will ${base}`;
    return subj ? `${subj} ${base}` : base;
  }
  if (pos === "N") {
    const number = m[3] || "";
    const state = m[4] || "";
    const isPlural = number === "p" || number === "d";
    const firstWord = base.split(" ")[0];
    const rest = base.includes(" ") ? base.slice(base.indexOf(" ")) : "";
    const displayBase = isPlural ? engPlural(firstWord) + rest : base;
    return state === "c" ? `of ${displayBase}` : displayBase;
  }
  if (pos === "A") {
    const number = m[3] || "";
    const isPlural = number === "p";
    const firstWord = base.split(" ")[0];
    const rest = base.includes(" ") ? base.slice(base.indexOf(" ")) : "";
    return isPlural ? engPlural(firstWord) + rest : base;
  }
  return base;
}

function getOccurrences(strongs: number, mode: TextMode, hebrew = false): { total: number; books: Record<string, number> } {
  const result: Record<string, number> = {};
  let total = 0;
  if (hebrew && window.RhemaHebrewOT) {
    for (const book of (window.RhemaHebrewOT.books || OT_BOOK_ORDER)) {
      const bookText = window.RhemaHebrewOT.text[book] || {};
      let count = 0;
      for (const ch of Object.keys(bookText)) {
        for (const v of Object.keys(bookText[ch])) {
          count += (bookText[ch][v] || []).filter((w: Word) => w[1] === strongs).length;
        }
      }
      if (count > 0) { result[book] = count; total += count; }
    }
  } else {
    const text = getText(mode);
    for (const book of getBookOrder(mode)) {
      const bookText = text[book] || {};
      let count = 0;
      for (const ch of Object.keys(bookText)) {
        for (const v of Object.keys(bookText[ch])) {
          count += (bookText[ch][v] || []).filter((w: Word) => w[1] === strongs).length;
        }
      }
      if (count > 0) { result[book] = count; total += count; }
    }
  }
  return { total, books: result };
}

function getVariantSet(book: string, ch: string, v: string, mode: TextMode): Set<number> {
  if (!NT_BOOK_ORDER.includes(book)) return new Set();
  const majority = window.RhemaNT?.text[book]?.[ch]?.[v] || [];
  const critical = window.RhemaCriticalNT?.text[book]?.[ch]?.[v] || [];
  if (!majority.length && !critical.length) return new Set();
  const current = mode === "majority" ? majority : critical;
  const other   = mode === "majority" ? critical : majority;
  const out = new Set<number>();
  for (let i = 0; i < current.length; i++) {
    if (!other[i] || current[i][1] !== other[i][1]) out.add(i);
  }
  return out;
}

function parseCrossRefKey(ref: string): { book: string; ch: string; v: string } | null {
  const [loc] = ref.split("|");
  const spaceIdx = loc.lastIndexOf(" ");
  if (spaceIdx < 0) return null;
  const book = loc.slice(0, spaceIdx);
  const [ch, v] = loc.slice(spaceIdx + 1).split(":");
  if (!ch || !v) return null;
  return { book, ch, v };
}

/* Strip Greek diacritics/accents for accent-insensitive matching */
function stripGreekAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLowerCase();
}

/* Lexicon search: prefix-first for Greek, English definition fallback */
function searchLexicon(query: string): Array<{ strongs: number; lex: LexEntry }> {
  if (!query.trim() || !window.RhemaLexicon) return [];
  const isGreek = /[Ͱ-Ͽἀ-῿Ͱ-Ͽ]/.test(query);
  const qn = isGreek ? stripGreekAccents(query) : query.toLowerCase();
  const prefix: Array<{ strongs: number; lex: LexEntry }> = [];
  const contains: Array<{ strongs: number; lex: LexEntry }> = [];
  const defMatch: Array<{ strongs: number; lex: LexEntry }> = [];
  for (const [key, lex] of Object.entries(window.RhemaLexicon)) {
    const entry = { strongs: Number(key), lex };
    if (isGreek) {
      const lemmaStripped = stripGreekAccents(lex.lemma || "");
      if (lemmaStripped.startsWith(qn)) { prefix.push(entry); continue; }
      if (lemmaStripped.includes(qn)) { contains.push(entry); continue; }
    } else {
      const trans = (lex.translit || "").toLowerCase();
      const brief = (lex.brief || "").replace(/<[^>]+>/g, "").toLowerCase();
      const qd    = (lex.quick_def || "").replace(/<[^>]+>/g, "").toLowerCase();
      if (trans.startsWith(qn)) { prefix.push(entry); continue; }
      if (trans.includes(qn))   { contains.push(entry); continue; }
      if (query.length >= 3 && (brief.includes(qn) || qd.includes(qn))) defMatch.push(entry);
    }
  }
  return [...prefix, ...contains, ...defMatch].slice(0, 30);
}

/* Scan NT text for exact surface-form matches, keyed by surface+morph to keep
   distinct inflections separate (prevents dative/nominative from merging) */
function scanNTForms(query: string): Array<{ surface: string; morph: string; strongs: number; count: number; exact: boolean }> {
  if (!/[Ͱ-Ͽἀ-῿Ͱ-Ͽ]/.test(query)) return [];
  const text = getText("majority");
  if (!text) return [];
  const qn = stripGreekAccents(query);
  const found: Record<string, { surface: string; morph: string; strongs: number; count: number; exact: boolean }> = {};
  for (const book of NT_BOOK_ORDER) {
    const bdata = text[book] || {};
    for (const ch of Object.keys(bdata)) {
      for (const v of Object.keys(bdata[ch])) {
        for (const word of (bdata[ch][v] || [])) {
          const sn = stripGreekAccents(word[0]);
          const isExact = sn === qn;
          const isPrefix = !isExact && sn.startsWith(qn);
          if (!isExact && !isPrefix) continue;
          const key = word[0] + "|" + word[2];
          if (!found[key]) found[key] = { surface: word[0], morph: word[2], strongs: word[1], count: 0, exact: isExact };
          found[key].count++;
        }
      }
    }
  }
  return Object.values(found)
    .sort((a, b) => (b.exact ? 1000 : 0) + b.count - (a.exact ? 1000 : 0) - a.count)
    .slice(0, 20);
}

/* Human-readable label for an inflected form from morph code */
function getMorphFormLabel(morph: string): string {
  if (!morph) return "";
  const rows = decodeMorph(morph);
  const caseRow = rows.find(r => r.label === "Case");
  if (caseRow?.value) {
    const numRow = rows.find(r => r.label === "Number");
    const genRow = rows.find(r => r.label === "Gender");
    return [caseRow.value, numRow?.value, genRow?.value].filter(Boolean).join(" ");
  }
  const moodRow = rows.find(r => r.label === "Mood");
  if (moodRow?.value) {
    const tensRow = rows.find(r => r.label === "Tense");
    const persRow = rows.find(r => r.label === "Person");
    const numRow  = rows.find(r => r.label === "Number");
    return [tensRow?.value, moodRow.value, persRow?.value, numRow?.value].filter(Boolean).join(" ");
  }
  const formRow = rows.find(r => r.label === "Form");
  if (formRow?.value) return formRow.value;
  const posRow = rows.find(r => r.label === "Part of Speech");
  return posRow?.value || "";
}

/* Find any morph code in NT text for a given strongs number — used when
   opening a lexical entry from the library so the Parsing tab has data */
function findAnyMorphForStrongs(strongs: number): string {
  const text = getText("majority");
  for (const book of NT_BOOK_ORDER) {
    const bdata = text[book] || {};
    for (const ch of Object.keys(bdata)) {
      for (const v of Object.keys(bdata[ch])) {
        for (const word of (bdata[ch][v] || [])) {
          if (word[1] === strongs && word[2]) return word[2];
        }
      }
    }
  }
  return "";
}
const SX_CLAUSE_TYPES: Record<number, string> = {
  2443:"purpose", 3704:"purpose",
  3754:"content", 5620:"result",
  1487:"conditional", 1437:"conditional",
  3739:"relative", 3748:"relative", 3699:"relative",
  3752:"temporal", 3753:"temporal", 2193:"temporal", 4250:"temporal",
  5613:"comparative", 2531:"comparative", 5618:"comparative", 2509:"comparative",
  1893:"causal", 1894:"causal", 1063:"explanatory",
  3767:"inferential", 1352:"inferential", 3606:"inferential", 686:"inferential",
  235:"adversative", 4133:"adversative",
  2532:"coordinating", 1161:"coordinating", 5037:"coordinating", 3303:"coordinating",
  2228:"alternative", 1535:"alternative", 3777:"coordinating",
};
const SX_CLAUSE_LABELS: Record<string, string> = {
  purpose:"Purpose", content:"Content Clause", result:"Result",
  conditional:"Conditional", relative:"Relative Clause", temporal:"Temporal",
  comparative:"Comparison", causal:"Reason", explanatory:"Reason",
  inferential:"Conclusion", adversative:"Contrast",
  coordinating:"Continued", alternative:"Alternative", conjunction:"Clause",
};
const SX_CLAUSE_SUBTITLES: Record<string, string> = {
  coordinating:"continues the thought", adversative:"sets up a contrast",
  purpose:"in order that…", content:"explains what was said / thought",
  result:"so that…", conditional:"if…", relative:"which / who…",
  temporal:"when / while…", comparative:"just as…", causal:"because…",
  explanatory:"explains the reason", inferential:"therefore…", alternative:"or…",
};
const SX_CLAUSE_COLORS: Record<string, string> = {
  main:"#c9a84c", coordinating:"#6b7280", conjunction:"#6b7280",
  purpose:"#8b5cf6", content:"#3b82f6", result:"#10b981", conditional:"#f59e0b",
  relative:"#06b6d4", temporal:"#f97316", comparative:"#84cc16",
  causal:"#ec4899", explanatory:"#6366f1", inferential:"#14b8a6",
  adversative:"#ef4444", alternative:"#a78bfa",
};
const SX_PREP_LABELS: Record<number, (c: string | null) => string> = {
  1223: c => c === "G" ? "through / by means of" : "because of",
  1722: () => "in / within", 1519: () => "into / toward", 4314: () => "toward / to",
  1537: () => "from / out of", 575: () => "from / away from",
  5259: c => c === "G" ? "by (agent)" : "under",
  5228: c => c === "G" ? "on behalf of" : "above / beyond",
  2596: c => c === "G" ? "against / down from" : "according to",
  3326: c => c === "G" ? "with / among" : "after",
  4862: () => "with / together with",
  1909: c => c === "G" ? "on / over" : c === "D" ? "on / at" : "upon / onto",
  3844: c => c === "G" ? "from beside" : c === "D" ? "beside / near" : "alongside",
  4253: () => "before / in front of",
  4012: c => c === "G" ? "concerning / about" : "around / near",
};
const SX_NEG_STRONGS  = new Set([3756, 3361, 3762, 3367, 3765]);
const SX_DIST_STRONGS = new Set([3112, 1451, 4139]);
const SX_LOC_STRONGS  = new Set([1563, 847, 1759, 3606, 1566]);
const SX_TIME_STRONGS = new Set([3568, 5119, 4218, 3753, 1534, 1899]);

/* Chip color classes: subj=blue, verb=orange, obj=red, gen=purple, dat=teal, prep=green, part=yellow, conj=gray, other=slate */
const SX_CHIP: Record<string, { bg: string; border: string; text: string }> = {
  subj:  { bg: "bg-blue-500/10",   border: "border-blue-500/40",   text: "text-blue-400" },
  verb:  { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-400" },
  obj:   { bg: "bg-red-500/10",    border: "border-red-500/40",    text: "text-red-400" },
  gen:   { bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400" },
  dat:   { bg: "bg-teal-500/10",   border: "border-teal-500/40",   text: "text-teal-400" },
  prep:  { bg: "bg-green-500/10",  border: "border-green-500/40",  text: "text-green-400" },
  part:  { bg: "bg-yellow-500/10", border: "border-yellow-500/40", text: "text-yellow-400" },
  conj:  { bg: "bg-zinc-500/10",   border: "border-zinc-500/40",   text: "text-zinc-400" },
  other: { bg: "bg-slate-500/10",  border: "border-slate-500/40",  text: "text-slate-400" },
};

const SX_ROLE_INFO: Record<string, { title: string; body: string; range: string | null; example: string | null; question: string }> = {
  subject:        { title:"Subject — Who or what is doing it", body:"The nominative case marks the subject. Greek doesn't rely on word order — the case ending shows who acts, so the subject can appear anywhere in the sentence.", range:null, example:"In English, word order tells you who did what. In Greek, the nominative case ending does that job regardless of position.", question:"Who is performing this action? Is there anything significant about who the subject is in this context?" },
  predicate:      { title:"Verb — The action or state", body:"The finite verb is the engine of the clause. A single Greek verb encodes: what is happening, when/how complete (tense-aspect), who acts or is acted on (voice), the speaker's certainty (mood), and who is doing it (person/number).", range:"Voice: active = subject acts; passive = subject receives; middle = subject acts for own benefit. Mood: indicative = real; subjunctive = potential; imperative = command; optative = wish.", example:"Aorist = a single completed event; present = ongoing action; perfect = past act whose result still stands. Each encodes a different aspect of the action.", question:"What tense, voice, and mood is this verb? What do those layers tell you?" },
  object:         { title:"Direct Object — What receives the action", body:"The accusative case marks the direct object — what the verb acts on, regardless of word order.", range:"Also expresses extent of time/space, direction, or is required by certain prepositions (εἰς, κατά, διά).", example:"Greek uses case endings to mark the direct object regardless of word position, unlike English which relies on word order.", question:"What is being affected by this action? Does the word choice carry meaning beyond the simple action?" },
  genitive:       { title:"Genitive — A relationship to another word", body:"The genitive shows how one word relates to another noun. English translates it with 'of' — but that covers many distinct Greek relationships.", range:"Possible: possession, source, description, partition, separation, or verbal (subjective = God acts; objective = action toward God).", example:"English 'of' covers: 'cup of coffee' (contents), 'man of courage' (description), 'king's decision' (possession). Greek genitive works the same way.", question:"What is the nature of this relationship — possession, source, or description? Which fits the context?" },
  dative:         { title:"Dative — To, for, by, in, or with", body:"The dative is Greek's most versatile case. English splits its meaning across several prepositions.", range:"Indirect object, means/instrument, location/sphere, manner, or the interested party.", example:"English uses different prepositions: 'to her' (recipient), 'with a knife' (instrument), 'in the room' (location). Greek uses one dative case ending.", question:"Which preposition fits best — to, for, by, in, or with? Does trying different prepositions change your understanding?" },
  accusative:     { title:"Accusative — Extent, direction, or object of preposition", body:"Here the accusative expresses extent of time/space, direction, or is the required object of a preposition.", range:"Common with εἰς, κατά, διά. The preposition determines the exact meaning.", example:"'Three miles' (extent) and 'the store' (direction) are both accusative in Greek when modifying movement.", question:"What is this expressing — direction, extent, purpose, or object of a preposition?" },
  vocative:       { title:"Direct Address — Speaking to someone", body:"The vocative case addresses someone directly. It steps outside the grammar to speak to a person or entity.", range:null, example:"In 'David, come here!' the name steps outside the sentence grammar. Greek marks this with its own case ending.", question:"Who is being addressed? What does the title used tell you about the speaker's understanding of this person?" },
  modifier:       { title:"Prepositional Phrase — Location, direction, or relationship", body:"A preposition + object phrase. In Greek, the case of the object changes the meaning of the preposition — sometimes dramatically.", range:"ἐν + dative = in/among; εἰς + accusative = into/toward; ἐκ + genitive = out of; διά + genitive = through; διά + accusative = because of.", example:"Greek often uses the same preposition but different cases for different meanings. The case does the work that different English prepositions do.", question:"What does this phrase say about location, direction, means, or sphere? Does the case shift the meaning?" },
  attributive:    { title:"Attributive Participle — Describing a person or thing", body:"A participle with an article acts like an adjective — it describes a noun by its characteristic action.", range:"Best translated as a relative clause: ὁ πιστεύων = 'the one who believes.' Present tense = ongoing/habitual; aorist = completed act.", example:"'The running man' and 'the man who runs' say the same thing — the article + description defines a person by what they do.", question:"What characteristic does this attach to the person? Why does the tense choice (ongoing vs. completed) matter?" },
  circumstantial: { title:"Circumstantial Participle — When, why, or how", body:"A participle without an article frames or qualifies the main verb.", range:"Temporal ('while/after'), causal ('because'), means ('by doing'), conditional ('if'), concessive ('even though').", example:"Greek marks timing with tense: aorist participle = action before main verb; present = simultaneous.", question:"Is this telling you when, why, how, or under what condition? Does the tense affect the timing relationship?" },
  infinitive:     { title:"Infinitive — A verb acting as a noun", body:"The Greek infinitive is a verbal noun. It carries the verb's action but plays a noun role — subject, object, or complement.", range:"Purpose (τοῦ/εἰς τό), result, content, or complement of main verb.", example:"'To run' can be a subject, object, or purpose in English. Greek infinitives work identically.", question:"What role is this infinitive playing — purpose, result, content, or complement?" },
  prednom:        { title:"Predicate Nominative — What the subject is", body:"When a linking verb connects two nominatives, the second one completes or defines the first.", range:"The article usually distinguishes subject from predicate (Colwell's Rule — a guide, not absolute).", example:"'Lincoln was president' — 'president' defines what Lincoln was. The linking verb acts as an equals sign.", question:"What does this predicate tell you about the identity of the subject? Is it defining or describing?" },
  conjunction:    { title:"Conjunction — How this clause connects", body:"Conjunctions tell you the logical relationship between clauses. Reading past them is one of the most common ways to miss the author's argument.", range:"ἵνα = purpose/result; ὅτι = content/reason; ὥστε = result; εἰ = condition (real); ἐάν = condition (uncertain).", example:"'So that,' 'because,' 'if,' and 'when' each signal a different relationship. Greek conjunctions do precise logical work.", question:"What relationship does this signal — goal, consequence, reason, or condition? What would be lost without it?" },
  particle:       { title:"Particle — Tone, contrast, or emphasis", body:"Particles shade meaning in ways easy to miss in translation. γάρ = 'for/because'; δέ = mild contrast; ἀλλά = strong contrast; γέ = emphasis.", range:null, example:"'Well,' 'after all,' 'so,' and 'indeed' are small words that set tone. Greek particles do this at the sentence level.", question:"What is this contributing — explanation, contrast, emphasis, negation? What would be lost without it?" },
  negation:       { title:"Negation — Not / No", body:"οὐ negates factual statements; μή negates commands, conditions, and purposes.", range:"Compounds: οὐκέτι = no longer; οὐδέποτε = never. Doubled negative (οὐ μή) intensifies rather than cancels.", example:"Greek distinguishes factual negations (οὐ) from volitional/conditional ones (μή). The choice reveals how the statement is framed.", question:"Is this factual (οὐ) or volitional (μή)? What is being negated — verb, adjective, or a specific element?" },
  adverb:         { title:"Adverb — How, where, or when", body:"An adverb modifies a verb, adjective, or other adverb. It adds circumstantial detail.", range:"Manner (how), place (where), time (when). Fronted adverbs often carry emphasis.", example:"Greek adverbs commonly end in -ως. Fronting an adverb draws attention to that circumstance.", question:"What kind — manner, place, or time? Is its position emphasizing this circumstance?" },
  unknown:        { title:"Phrase", body:"The grammatical structure is uncertain from morphology alone.", range:null, example:null, question:"Try clicking the individual words to see their parsing — you may be able to work out the structure from there." },
};

/* ── Syntax tree: helpers ────────────────────────────────────── */
function sxPos(morph: string): string {
  if (!morph) return "UNK";
  const p = morph.split("-")[0];
  if (p === "T") return "ART";
  if (p === "N" || p === "RI") return "NOUN";
  if (p === "V") return "VERB";
  if (p === "A") return "ADJ";
  if (["P","R","C","D","F","I","K","Q","X"].includes(p)) return "PRON";
  if (p === "PREP") return "PREP";
  if (p === "CONJ") return "CONJ";
  if (p === "ADV") return "ADV";
  if (p === "COND") return "COND";
  return "PART";
}

function sxCNG(morph: string): { case: string; number: string; gender: string | null } | null {
  if (!morph) return null;
  for (const seg of morph.split("-").slice(1)) {
    if (/^[NGDAV][SP][MFN]$/.test(seg)) return { case: seg[0], number: seg[1], gender: seg[2] };
    if (/^[NGDAV][SP]$/.test(seg))       return { case: seg[0], number: seg[1], gender: null };
    if (/^\d[NGDAV][SP]$/.test(seg))     return { case: seg[1], number: seg[2], gender: null };
  }
  return null;
}

function sxVerbType(morph: string): "finite" | "participle" | "infinitive" | null {
  if (!morph || !morph.startsWith("V-")) return null;
  const form = (morph.split("-")[1] || "").replace(/^2/, "");
  const m = form[form.length - 1];
  if (m === "P") return "participle";
  if (m === "N") return "infinitive";
  return "finite";
}

function sxVerbPerson(morph: string): number | null {
  if (!morph || !morph.startsWith("V-")) return null;
  const m = (morph.split("-")[2] || "").match(/^([123])/);
  return m ? parseInt(m[1]) : null;
}

function sxGetRoleMap(words: Word[], book: string, chapter: string, verse: string): Record<number, string> | null {
  const verseData = window.RhemaSyntax?.[book]?.[chapter]?.[verse];
  if (!verseData?.length) return null;
  const roleMap: Record<number, string> = {};
  for (const [dsPos, dsStrongs, role] of verseData) {
    const exact = dsPos - 1;
    if (exact >= 0 && exact < words.length && words[exact][1] === dsStrongs) {
      roleMap[exact] = role; continue;
    }
    const lo = Math.max(0, dsPos - 5), hi = Math.min(words.length - 1, dsPos + 1);
    for (let i = lo; i <= hi; i++) {
      if (words[i][1] === dsStrongs && roleMap[i] === undefined) { roleMap[i] = role; break; }
    }
  }
  return Object.keys(roleMap).length ? roleMap : null;
}

function sxGroupPhrases(words: Word[]): { phrases: SxPhrase[]; cats: SxCat[] } {
  const cats: SxCat[] = words.map((w, i) => ({
    i, surface: w[0], strongs: w[1], morph: w[2],
    pos: sxPos(w[2]), cng: sxCNG(w[2]), vtype: sxVerbType(w[2]),
  }));
  const phrases: SxPhrase[] = [];
  let i = 0;
  while (i < cats.length) {
    const c = cats[i];
    if (c.pos === "CONJ" || c.pos === "COND") {
      phrases.push({ type: "conjunction", clauseType: SX_CLAUSE_TYPES[c.strongs] || "conjunction", role: "", label: "", color: "conj", words: [i] });
      i++; continue;
    }
    if (c.pos === "ART") {
      const g: SxPhrase = { type: "noun-phrase", role: "", label: "", color: "other", words: [i] };
      const artCase = c.cng?.case;
      i++;
      while (i < cats.length) {
        const n = cats[i];
        if (["CONJ","COND","PREP"].includes(n.pos)) break;
        if (n.pos === "VERB" && n.vtype === "finite") break;
        if (n.pos === "ART" && n.cng?.case !== artCase) break;
        if (n.pos === "ART") { g.words.push(i); i++; continue; }
        if (n.pos === "VERB" && n.vtype === "participle") { g.type = "articular-participle"; g.words.push(i); i++; continue; }
        if (["NOUN","ADJ","PRON"].includes(n.pos)) {
          if (g.type === "noun-phrase" && n.pos !== "NOUN") g.type = n.pos === "ADJ" ? "adj-phrase" : "pron-phrase";
          g.words.push(i); i++; continue;
        }
        break;
      }
      if (g.words.length === 1) {
        if (i < cats.length && cats[i].pos === "ADV") {
          g.type = "adv-group"; if (artCase) g.artCase = artCase; g.words.push(i); i++;
        } else {
          g.type = "particle";
        }
      }
      phrases.push(g); continue;
    }
    if (c.pos === "PREP") {
      const g: SxPhrase = { type: "prep-phrase", role: "", label: "", color: "prep", words: [i], prepStrongs: c.strongs };
      i++;
      let prepObjCase: string | null = null;
      while (i < cats.length) {
        const n = cats[i];
        if (["CONJ","COND"].includes(n.pos)) break;
        if (n.pos === "VERB" && n.vtype === "finite") break;
        if (["ART","NOUN","ADJ","PRON"].includes(n.pos)) {
          if (!prepObjCase && n.cng?.case) prepObjCase = n.cng.case;
          g.words.push(i); i++; continue;
        }
        break;
      }
      g.prepObjCase = prepObjCase;
      phrases.push(g); continue;
    }
    if (c.pos === "VERB") {
      if (c.vtype === "finite") { phrases.push({ type: "finite-verb", role: "", label: "", color: "verb", words: [i] }); i++; continue; }
      if (c.vtype === "participle") {
        const g: SxPhrase = { type: "participle-phrase", role: "", label: "", color: "part", words: [i] }; i++;
        while (i < cats.length) {
          const n = cats[i];
          if (["CONJ","COND","PREP","ART","VERB"].includes(n.pos)) break;
          if (["NOUN","PRON"].includes(n.pos) && n.cng?.case === "A") { g.words.push(i); i++; continue; }
          break;
        }
        phrases.push(g); continue;
      }
      phrases.push({ type: "infinitive", role: "", label: "", color: "part", words: [i] }); i++; continue;
    }
    if (c.pos === "NOUN" || c.pos === "PRON") {
      const g: SxPhrase = { type: c.pos === "NOUN" ? "noun-phrase" : "pron-phrase", role: "", label: "", color: "other", words: [i] }; i++;
      while (i < cats.length) {
        if (cats[i].pos === "PRON" && cats[i].cng?.case === "G") { g.words.push(i); i++; continue; }
        break;
      }
      phrases.push(g); continue;
    }
    if (c.pos === "ADJ") { phrases.push({ type: "adj-phrase", role: "", label: "", color: "other", words: [i] }); i++; continue; }
    if (c.pos === "ADV") { phrases.push({ type: "adverb", role: "", label: "", color: "other", words: [i] }); i++; continue; }
    phrases.push({ type: "particle", role: "", label: "", color: "other", words: [i] }); i++;
  }
  return { phrases, cats };
}

function sxAssignRoles(phrases: SxPhrase[], cats: SxCat[], roleMap: Record<number, string> | null): void {
  const hasFiniteVerb = phrases.some(p => p.type === "finite-verb");
  const COPULA = new Set([1510, 1096, 5225]);
  let copulaPhrase: SxPhrase | null = null;
  for (const p of phrases) {
    if (p.type === "finite-verb" && COPULA.has(cats[p.words[0]]?.strongs)) { copulaPhrase = p; break; }
  }
  const hasCopula = !!copulaPhrase;
  const copulaPerson = copulaPhrase ? sxVerbPerson(cats[copulaPhrase.words[0]]?.morph || "") : null;
  const EXPLICIT_SUBJ = new Set([1473, 4771, 2249, 5210]);
  const implicitSubject = hasCopula && (copulaPerson === 1 || copulaPerson === 2);
  let nomCount = 0, predNomAssigned = 0;
  const copulaCount = phrases.filter(p => p.type === "finite-verb" && COPULA.has(cats[p.words[0]]?.strongs)).length;

  for (const p of phrases) {
    if (p.type === "finite-verb") {
      p.role = "predicate"; p.label = "Verb"; p.color = "verb"; p.isMainVerb = true;
    } else if (p.type === "conjunction") {
      p.role = "conjunction"; p.label = SX_CLAUSE_LABELS[p.clauseType || ""] || "Conjunction"; p.color = "conj";
    } else if (p.type === "prep-phrase") {
      p.role = "modifier"; p.color = "prep";
      const fn = p.prepStrongs ? SX_PREP_LABELS[p.prepStrongs] : null;
      const prepLabel = fn ? fn(p.prepObjCase || null) : null;
      p.label = prepLabel ? prepLabel.charAt(0).toUpperCase() + prepLabel.slice(1) : "Prep. Phrase";
      p.plainLabel = prepLabel || "how / where / by what";
    } else if (p.type === "adv-group") {
      p.role = "adv-group"; p.label = "Group"; p.color = "other"; p.plainLabel = "which group";
    } else if (p.type === "adverb") {
      const fs = cats[p.words[0]]?.strongs;
      p.label = "Adverb"; p.color = "other";
      if (SX_NEG_STRONGS.has(fs!)) { p.role = "negation"; p.label = "Negation"; p.plainLabel = "negates"; }
      else if (SX_DIST_STRONGS.has(fs!)) { p.role = "adverb"; p.plainLabel = "how far / where"; }
      else if (SX_LOC_STRONGS.has(fs!))  { p.role = "adverb"; p.plainLabel = "state / location"; }
      else if (SX_TIME_STRONGS.has(fs!)) { p.role = "adverb"; p.plainLabel = "when"; }
      else { p.role = "adverb"; p.plainLabel = "describes"; }
    } else if (p.type === "articular-participle") {
      p.role = "attributive"; p.label = "Attr. Participle"; p.color = "part";
    } else if (p.type === "participle-phrase") {
      p.role = "circumstantial"; p.label = "Participle"; p.color = "part";
    } else if (p.type === "infinitive") {
      p.role = "infinitive"; p.label = "Infinitive"; p.color = "part";
    } else if (p.type === "particle") {
      const fs = cats[p.words[0]]?.strongs;
      if (SX_NEG_STRONGS.has(fs!)) { p.role = "negation"; p.label = "Negation"; p.color = "other"; p.plainLabel = "negates"; }
      else if (SX_CLAUSE_TYPES[fs!]) { p.role = "conjunction"; p.label = SX_CLAUSE_LABELS[SX_CLAUSE_TYPES[fs!]] || "Connects"; p.color = "conj"; p.plainLabel = "connects"; }
      else { p.role = "particle"; p.label = "Particle"; p.color = "other"; }
    } else {
      const cng = cats[p.words[0]]?.cng;
      if (!cng) { p.role = "unknown"; p.label = "?"; p.color = "other"; continue; }
      if (cng.case === "N") {
        const fs = cats[p.words[0]]?.strongs;
        if (hasCopula && implicitSubject && !EXPLICIT_SUBJ.has(fs!)) {
          p.role = "prednom"; p.label = "Predicate"; p.color = "verb";
          p.plainLabel = copulaPerson === 2 ? "what you are" : "what I am";
          predNomAssigned++;
        } else if (hasCopula) {
          nomCount++;
          if (nomCount > 1 && predNomAssigned < copulaCount) {
            predNomAssigned++; p.role = "prednom"; p.label = "Predicate"; p.color = "verb";
          } else {
            p.role = "subject"; p.label = "Subject"; p.color = "subj";
          }
        } else {
          p.role = "subject"; p.label = "Subject"; p.color = "subj";
        }
      } else {
        const cm: Record<string, { role: string; label: string; color: string }> = {
          G: { role:"genitive",  label:"Genitive",  color:"gen" },
          D: { role:"dative",    label:"Dative",    color:"dat" },
          A: { role: hasFiniteVerb ? "object" : "accusative", label: hasFiniteVerb ? "Object" : "Accusative", color:"obj" },
          V: { role:"vocative",  label:"Address",   color:"subj" },
        };
        const m = cm[cng.case] || { role:"unknown", label:"?", color:"other" };
        p.role = m.role; p.label = m.label; p.color = m.color;
      }
    }
  }
  const DEP_ANCHORS = new Set(["subject","object","prednom"]);
  for (let i = 1; i < phrases.length; i++) {
    if (phrases[i].role === "genitive" && DEP_ANCHORS.has(phrases[i-1].role)) phrases[i].isDep = true;
  }
  if (roleMap) {
    for (const p of phrases) {
      for (const wi of p.words) {
        const dr = roleMap[wi];
        if (!dr) continue;
        if (dr === "p") { p.role = "prednom"; p.label = "Predicate"; p.color = "verb"; p.fromDataset = true; if (!p.plainLabel) p.plainLabel = copulaPerson === 2 ? "what you are" : "what it is"; }
        else if (dr === "s") { p.role = "subject"; p.label = "Subject"; p.color = "subj"; p.fromDataset = true; delete p.plainLabel; }
        else if (dr === "o") { p.role = "object"; p.label = "Object"; p.color = "obj"; p.fromDataset = true; delete p.plainLabel; }
        else if (dr === "o2") { p.role = "object"; p.label = "Object (2)"; p.color = "obj"; p.fromDataset = true; }
        break;
      }
    }
  }
}

function sxBuildTree(words: Word[], book: string, chapter: string, verse: string): { tree: SxClause; cats: SxCat[] } {
  const { phrases, cats } = sxGroupPhrases(words);
  const roleMap = sxGetRoleMap(words, book, chapter, verse);
  sxAssignRoles(phrases, cats, roleMap);

  /* Fix subject labels in passive segments */
  for (let pi = 0; pi < phrases.length; pi++) {
    const verbP = phrases[pi];
    if (verbP.type !== "finite-verb") continue;
    const morph = cats[verbP.words[0]]?.morph || "";
    const form = (morph.split("-")[1] || "").replace(/^2/, "");
    const voice = form[1];
    if (voice === "P" || voice === "O" || voice === "N") {
      for (const p of phrases) {
        if (p.role === "subject" && !p.fromDataset) p.plainLabel = "who / what is acted on";
      }
    }
  }

  const SX_NONSPLIT = new Set(["explanatory","inferential","conjunction"]);
  const segments: SxClause[] = [];
  let cur: SxClause = { clauseType: "main", label: "Main Clause", conjPhrase: null, phrases: [], isSubordinate: false, children: [] };
  for (const p of phrases) {
    if (p.type === "conjunction") {
      if (SX_NONSPLIT.has(p.clauseType || "")) { cur.phrases.push(p); continue; }
      const isSubord = !["coordinating","adversative","alternative"].includes(p.clauseType || "");
      if (cur.phrases.length || cur.conjPhrase) segments.push(cur);
      cur = { clauseType: p.clauseType || "conjunction", label: SX_CLAUSE_LABELS[p.clauseType || ""] || "Clause", conjPhrase: p, phrases: [], isSubordinate: isSubord, children: [] };
    } else {
      cur.phrases.push(p);
    }
  }
  if (cur.phrases.length || cur.conjPhrase) segments.push(cur);
  if (!segments.length) segments.push({ clauseType: "main", label: "Main Clause", conjPhrase: null, phrases, isSubordinate: false, children: [] });

  const roots: SxClause[] = [];
  const stk: SxClause[] = [];
  for (const seg of segments) {
    if (!seg.isSubordinate) {
      if (!stk.length) { roots.push(seg); stk.push(seg); }
      else { if (stk.length > 1) stk.pop(); stk[stk.length-1].children.push(seg); stk.push(seg); }
    } else {
      if (stk.length) stk[stk.length-1].children.push(seg);
      else roots.push(seg);
      stk.push(seg);
    }
  }

  const tree = roots.length === 1 ? roots[0] : {
    clauseType: "main", label: "Main Clause", conjPhrase: null, phrases: [], isSubordinate: false, children: roots,
  };
  return { tree, cats };
}

/* ── Font size config ───────────────────────────────────────── */
type FontSize = 1 | 2 | 3 | 4 | 5;
const FS_CONFIG: Record<FontSize, { chip: string; gloss: string; english: string }> = {
  1: { chip: "text-xl",  gloss: "text-[9px]",  english: "text-sm" },
  2: { chip: "text-2xl", gloss: "text-[10px]", english: "text-base" },
  3: { chip: "text-3xl", gloss: "text-xs",     english: "text-lg" },
  4: { chip: "text-4xl", gloss: "text-sm",     english: "text-xl" },
  5: { chip: "text-5xl", gloss: "text-base",   english: "text-2xl" },
};

/* ── Main component ─────────────────────────────────────────── */
export default function RhemaPage() {
  const { user } = useAuthContext();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hebrewMode, setHebrewMode] = useState(true);
  const [book, setBook] = useState("GEN");
  const [chapter, setChapter] = useState("1");
  const [verse, setVerse] = useState("1");
  const [textMode, setTextMode] = useState<TextMode>("majority");
  const [showEnglish, setShowEnglish] = useState(true);
  const [greekOnly, setGreekOnly] = useState(false);
  const [fullChapter, setFullChapter] = useState(false);
  const [activeWord, setActiveWord] = useState<Word | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("parsing");
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chPickerOpen, setChPickerOpen] = useState(false);
  const [vPickerOpen, setVPickerOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [grammarModal, setGrammarModal] = useState<{ category: string; value: string } | null>(null);
  const [showWandPopup, setShowWandPopup] = useState(false);
  const [syntaxMode, setSyntaxMode] = useState(false);
  const [selectedSxPhrase, setSelectedSxPhrase] = useState<SxPhrase | null>(null);
  const [, forceUpdate] = useState(0);
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("rhema-font-size");
      if (s) return Math.max(1, Math.min(5, Number(s))) as FontSize;
    }
    return 3;
  });
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [englishMode, setEnglishMode] = useState(false);
  const [phraseBuilderMode, setPhraseBuilderMode] = useState(false);
  const loadingRef = useRef(false);

  // Navigation history (persisted in localStorage)
  const [navHistory, setNavHistory] = useState<Array<{ book: string; chapter: string; verse: string }>>([]);
  const [navCursor, setNavCursor] = useState<number>(-1); // index into navHistory, -1 = at endpoint
  const [navEndpoint, setNavEndpoint] = useState<{ book: string; chapter: string; verse: string } | null>(null);

  // Right panel state
  const [showCrossRefs, setShowCrossRefs] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showHighlighter, setShowHighlighter] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Study workspace
  const [observations, setObservations] = useState("");
  const [interpretations, setInterpretations] = useState("");
  const [applications, setApplications] = useState("");
  const [questions, setQuestions] = useState("");
  const [studyTab, setStudyTab] = useState<"observations" | "interpretations" | "applications" | "questions">("observations");

  // Highlighter: intended categories persist; active = intended ∩ present in verse
  const [intendedHighlights, setIntendedHighlights] = useState<Set<string>>(new Set());
  const [shaking, setShaking] = useState<string | null>(null);

  // Library search
  const [libraryQuery, setLibraryQuery] = useState("");

  const [copied, setCopied] = useState(false);

  /* Restore persisted state from localStorage */
  useEffect(() => {
    try {
      const h = localStorage.getItem("rhema-nav-history");
      if (h) setNavHistory(JSON.parse(h));
      const hl = localStorage.getItem("rhema-highlights");
      if (hl) setIntendedHighlights(new Set(JSON.parse(hl)));
      const pos = localStorage.getItem("rhema-position");
      if (pos) {
        const { book: b, chapter: c, verse: v } = JSON.parse(pos);
        if (b && c && v) { setBook(b); setChapter(c); setVerse(v); }
      }
    } catch { /* ignore */ }
  }, []);

  /* Save current position */
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("rhema-position", JSON.stringify({ book, chapter, verse }));
  }, [loaded, book, chapter, verse]);

  /* Persist nav history */
  useEffect(() => {
    localStorage.setItem("rhema-nav-history", JSON.stringify(navHistory));
  }, [navHistory]);

  /* Persist intended highlights */
  useEffect(() => {
    localStorage.setItem("rhema-highlights", JSON.stringify([...intendedHighlights]));
  }, [intendedHighlights]);

  /* Load data scripts */
  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    let coreCount = 0;
    let failed = false;
    for (const file of DATA_FILES_CORE) {
      const s = document.createElement("script");
      s.src = `${STORAGE_BASE}${encodeURIComponent(file)}?alt=media`;
      s.onload = () => {
        coreCount++;
        if (coreCount === DATA_FILES_CORE.length) { setLoaded(true); forceUpdate(n => n + 1); }
      };
      s.onerror = () => { if (!failed) { failed = true; setLoadError(true); } };
      document.head.appendChild(s);
    }
    // Hebrew files load from GitHub — app works without them if unavailable
    let hebrewCount = 0;
    for (const file of DATA_FILES_HEBREW) {
      const s = document.createElement("script");
      s.src = `${HEBREW_BASE}${file}`;
      s.onload = () => {
        hebrewCount++;
        if (hebrewCount === DATA_FILES_HEBREW.length) forceUpdate(n => n + 1);
      };
      s.onerror = () => { /* Hebrew unavailable — silent fail */ };
      document.head.appendChild(s);
    }
  }, []);

  /* Load notes when passage changes */
  useEffect(() => {
    if (!loaded || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, "rhema_notes", user.uid, "passages", `${book}_${chapter}_${verse}`);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setObservations(data.observations || "");
          setInterpretations(data.interpretations || "");
          setApplications(data.applications || "");
          setQuestions(data.questions || "");
        } else {
          setObservations("");
          setInterpretations("");
          setApplications("");
          setQuestions("");
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [loaded, user, book, chapter, verse]);

  /* Keyboard navigation */
  useEffect(() => {
    if (!loaded) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") navigateVerse(1);
      if (e.key === "ArrowLeft")  navigateVerse(-1);
      if (e.key === "Escape") {
        setGrammarModal(null);
        setActiveWord(null);
        setBookPickerOpen(false);
        setChPickerOpen(false);
        setVPickerOpen(false);
        setShowCrossRefs(false);
        setShowNotes(false);
        setShowHighlighter(false);
        setShowLibrary(false);
        setShowWandPopup(false);
        setSelectedSxPhrase(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, book, chapter, verse, textMode]);

  const navigateVerse = useCallback((dir: 1 | -1) => {
    const heb = hebrewMode && isOTBook(book);
    const verses = getVerses(book, chapter, textMode, heb);
    const idx = verses.indexOf(verse);
    if (dir === 1) {
      if (idx < verses.length - 1) { setVerse(verses[idx + 1]); setActiveWord(null); }
      else {
        const chs = getChapters(book, textMode, heb);
        const ci = chs.indexOf(chapter);
        if (ci < chs.length - 1) {
          const nc = chs[ci + 1];
          const nv = getVerses(book, nc, textMode, heb)[0];
          setChapter(nc); setVerse(nv); setActiveWord(null);
        }
      }
    } else {
      if (idx > 0) { setVerse(verses[idx - 1]); setActiveWord(null); }
      else {
        const chs = getChapters(book, textMode, heb);
        const ci = chs.indexOf(chapter);
        if (ci > 0) {
          const nc = chs[ci - 1];
          const nvs = getVerses(book, nc, textMode, heb);
          setChapter(nc); setVerse(nvs[nvs.length - 1]); setActiveWord(null);
        }
      }
    }
  }, [book, chapter, verse, textMode, hebrewMode]);

  function selectBook(code: string) {
    const heb = hebrewMode && isOTBook(code);
    const chs = getChapters(code, textMode, heb);
    const firstCh = chs[0] || "1";
    const firstV = getVerses(code, firstCh, textMode, heb)[0] || "1";
    setBook(code); setChapter(firstCh); setVerse(firstV);
    setActiveWord(null); setBookPickerOpen(false); setBookSearch("");
    setNavHistory([]);
  }

  function selectChapter(ch: string) {
    const heb = hebrewMode && isOTBook(book);
    const firstV = getVerses(book, ch, textMode, heb)[0] || "1";
    setChapter(ch); setVerse(firstV);
    setActiveWord(null); setChPickerOpen(false);
  }

  function selectVerse(v: string) {
    setVerse(v); setActiveWord(null); setVPickerOpen(false);
  }

  function handleNavigateOccurrence(b: string, ch: string, v: string) {
    setNavHistory(h => [...h, { book, chapter, verse }]);
    setNavCursor(-1);
    setNavEndpoint({ book: b, chapter: ch, verse: v });
    setBook(b); setChapter(ch); setVerse(v);
    setFullChapter(false); setActiveWord(null);
  }

  function handleBack() {
    if (!navHistory.length) return;
    const last = navHistory[navHistory.length - 1];
    setNavHistory(h => h.slice(0, -1));
    setBook(last.book); setChapter(last.chapter); setVerse(last.verse);
    setActiveWord(null);
  }

  function jumpToHistoryStop(idx: number) {
    const stop = navHistory[idx];
    setNavCursor(idx);
    setBook(stop.book); setChapter(stop.chapter); setVerse(stop.verse);
    setActiveWord(null);
  }

  function jumpToEndpoint() {
    const ep = navEndpoint;
    if (!ep) return;
    setNavCursor(-1);
    setBook(ep.book); setChapter(ep.chapter); setVerse(ep.verse);
    setActiveWord(null);
  }

  function highlightWordFromNotes(strongs: number) {
    const ws = getWords(book, chapter, verse, textMode, isHebrew);
    const found = ws.find(w => w[1] === strongs);
    if (found) setActiveWord(found);
  }

  function copyVerse() {
    const ws = getWords(book, chapter, verse, textMode, isHebrew);
    const scriptText = ws.map(w => w[0]).join(" ");
    const english = getEnglishText(book, chapter, verse, textMode);
    const text = `${BOOK_NAMES[book] || book} ${chapter}:${verse}\n${scriptText}${english ? "\n" + english : ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }


  async function saveXrefTrail(trail: Array<{ book: string; ch: string; v: string }>) {
    if (!user) return;
    const display = trail.map(t => `${BOOK_NAMES[t.book] || t.book} ${t.ch}:${t.v}`).join(" → ");
    const trailRef = doc(db, "rhema_xref_trails", user.uid, "trails", Date.now().toString());
    await setDoc(trailRef, {
      trail: trail.map(t => `${t.book} ${t.ch}:${t.v}`),
      display,
      startRef: `${book} ${chapter}:${verse}`,
      createdAt: new Date(),
    });
  }

  function closeAllPanels() {
    setActiveWord(null);
    setShowCrossRefs(false);
    setShowNotes(false);
    setShowHighlighter(false);
    setShowLibrary(false);
    setShowWandPopup(false);
    setSelectedSxPhrase(null);
  }

  /* ── Computed values ── */
  const isHebrew    = hebrewMode && isOTBook(book) && hebrewAvailable();
  const allBooks    = loaded ? getBookOrder(textMode, hebrewMode && hebrewAvailable()) : [];
  const chapters    = loaded ? getChapters(book, textMode, isHebrew) : [];
  const verses      = loaded ? getVerses(book, chapter, textMode, isHebrew) : [];
  const bookName    = BOOK_NAMES[book] || book;
  const englishText = loaded ? getEnglishText(book, chapter, verse, textMode) : "";
  const variantSet  = loaded ? getVariantSet(book, chapter, verse, textMode) : new Set<number>();
  const crossRefs   = loaded ? (window.RhemaCrossRefs?.[`${book} ${chapter}:${verse}`] || null) : null;
  const hasCrossRefs = !!crossRefs && Object.values(crossRefs).some(a => a?.length > 0);
  const hasActiveMode = syntaxMode || fullChapter || greekOnly || textMode === "critical" || (!greekOnly && !showEnglish) || intendedHighlights.size > 0 || (isHebrew && hebrewMode) || englishMode || phraseBuilderMode;

  /* POS categories present in the current verse */
  const versePosCats = useMemo(() => {
    if (!loaded) return new Set<string>();
    const cats = new Set<string>();
    const normalizer = isHebrew ? normalizeHebrewPosKey : normalizePosKey;
    for (const w of getWords(book, chapter, verse, textMode, isHebrew)) {
      const cat = normalizer(w[2]);
      if (cat) cats.add(cat);
    }
    return cats;
  }, [loaded, book, chapter, verse, textMode, isHebrew]);

  /* Categories that are intended AND present in the current verse */
  const activeHighlights = useMemo(() => {
    const active = new Set<string>();
    for (const cat of intendedHighlights) {
      if (versePosCats.has(cat)) active.add(cat);
    }
    return active;
  }, [intendedHighlights, versePosCats]);

  function toggleHighlightCategory(cat: string) {
    if (intendedHighlights.has(cat)) {
      setIntendedHighlights(h => { const n = new Set(h); n.delete(cat); return n; });
    } else {
      if (!versePosCats.has(cat)) {
        setShaking(cat);
        setTimeout(() => setShaking(null), 500);
        return;
      }
      setIntendedHighlights(h => new Set([...h, cat]));
    }
  }

  /* libraryResults computed inside WordLibraryPanel to avoid scanning NT on every render */

  const filteredBooks = allBooks.filter(c =>
    (BOOK_NAMES[c] || c).toLowerCase().includes(bookSearch.toLowerCase())
  );
  const otBooks = filteredBooks.filter(c => OT_BOOK_ORDER.includes(c));
  const ntBooks = filteredBooks.filter(c => NT_BOOK_ORDER.includes(c));

  /* ── Render ─────────────────────────────────────────────── */
  if (!loaded && !loadError) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-accent" />
        <p className="text-sm text-text-muted">Loading Greek text data…</p>
        <p className="text-xs text-text-muted opacity-60">~54 MB — first load only</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-3">
        <p className="text-sm text-danger">Failed to load Rhema data files.</p>
        <button onClick={() => window.location.reload()} className="text-xs text-accent hover:text-accent-hover">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border-subtle bg-bg-surface shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 rounded-lg">
            <span className="font-serif text-base text-accent leading-none">Ρ</span>
          </div>
          <span className="text-sm font-semibold text-text-primary hidden sm:block">Rhema</span>
        </div>

        <button
          onClick={() => { setBookPickerOpen(true); setChPickerOpen(false); setVPickerOpen(false); }}
          className="flex items-center gap-1.5 px-3.5 h-9 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary font-medium transition-colors rounded-xl"
        >
          {bookName}
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>

        <button
          onClick={() => { setChPickerOpen(true); setBookPickerOpen(false); setVPickerOpen(false); }}
          className="flex items-center gap-1.5 px-3.5 h-9 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary transition-colors rounded-xl"
        >
          Ch {chapter}
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>

        {!fullChapter && (
          <button
            onClick={() => { setVPickerOpen(true); setBookPickerOpen(false); setChPickerOpen(false); }}
            className="flex items-center gap-1.5 px-3.5 h-9 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary transition-colors rounded-xl"
          >
            v {verse}
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>
        )}

        {!fullChapter && (
          <div className="flex items-center gap-1">
            <button onClick={() => navigateVerse(-1)} className="h-9 w-9 flex items-center justify-center bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-text-muted hover:text-text-primary transition-colors rounded-xl">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigateVerse(1)} className="h-9 w-9 flex items-center justify-center bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-text-muted hover:text-text-primary transition-colors rounded-xl">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Hebrew / LXX toggle */}
          {isOTBook(book) && (
            <button
              onClick={() => { setHebrewMode(v => !v); setActiveWord(null); }}
              title={hebrewMode ? "Switch to LXX (Greek OT)" : "Switch to Hebrew OT"}
              className={cn(
                "h-9 px-3.5 flex items-center gap-2 border transition-colors rounded-xl text-sm font-semibold",
                hebrewMode
                  ? "border-blue-500/60 bg-blue-500/15 text-blue-400"
                  : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
              )}
            >
              <span className="font-serif text-base" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>א</span>
              <span>{hebrewMode ? "Hebrew" : "LXX"}</span>
              {isOTBook(book) && hebrewMode && !hebrewAvailable() && (
                <span className="h-2 w-2 rounded-full border border-blue-400 border-t-transparent animate-spin ml-0.5" />
              )}
            </button>
          )}

          {/* Copy verse */}
          <button onClick={copyVerse} title="Copy verse"
            className={cn("h-9 w-9 flex items-center justify-center border transition-colors rounded-xl",
              copied ? "border-accent text-accent bg-accent/10" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
            )}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>

          <div className="w-px h-5 bg-border-subtle" />

          {/* Notes */}
          <ToolBtn
            active={showNotes}
            onClick={() => { setShowNotes(v => !v); setShowCrossRefs(false); setShowLibrary(false); setActiveWord(null); setShowWandPopup(false); }}
            label="Notes"
          >
            <FileText className="h-4 w-4" />
          </ToolBtn>

          {/* Word search */}
          <ToolBtn
            active={showLibrary}
            onClick={() => { setShowLibrary(v => !v); setShowCrossRefs(false); setShowNotes(false); setActiveWord(null); setShowWandPopup(false); }}
            label="Search"
          >
            <Search className="h-4 w-4" />
          </ToolBtn>

          {/* Cross references */}
          <ToolBtn
            active={showCrossRefs}
            onClick={() => { setShowCrossRefs(v => !v); setShowNotes(false); setShowHighlighter(false); setShowLibrary(false); setActiveWord(null); }}
            label="Refs"
            dot={hasCrossRefs && !showCrossRefs}
          >
            <Link2 className="h-4 w-4" />
          </ToolBtn>

          {/* Phrase builder */}
          <ToolBtn
            active={phraseBuilderMode}
            onClick={() => { setPhraseBuilderMode(v => !v); setEnglishMode(false); setSyntaxMode(false); setFullChapter(false); }}
            label="Phrase"
          >
            <Columns2 className="h-4 w-4" />
          </ToolBtn>

          {/* Display — contains font size, English, and all other view modes */}
          <div className="relative z-[39]">
            <button
              onClick={() => setShowWandPopup(v => !v)}
              title="Display & view options"
              className={cn("h-9 px-3.5 flex items-center gap-2 border transition-colors relative rounded-xl",
                showWandPopup || hasActiveMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">Display</span>
              {hasActiveMode && !showWandPopup && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
            {showWandPopup && (
              <WandPopup
                syntaxMode={syntaxMode} fullChapter={fullChapter}
                greekOnly={greekOnly} showEnglish={showEnglish}
                textMode={textMode} showHighlighter={showHighlighter}
                intendedCount={intendedHighlights.size}
                isOTBook={isOTBook(book)} hebrewMode={hebrewMode}
                hebrewAvailable={hebrewAvailable()}
                englishMode={englishMode}
                fontSize={fontSize}
                onToggleSyntax={() => { setSyntaxMode(v => !v); setShowWandPopup(false); setSelectedSxPhrase(null); }}
                onToggleChapter={() => setFullChapter(v => !v)}
                onToggleGreekOnly={() => setGreekOnly(v => !v)}
                onToggleEnglish={() => setShowEnglish(v => !v)}
                onToggleEnglishMode={() => { setEnglishMode(v => !v); setPhraseBuilderMode(false); setSyntaxMode(false); }}
                onToggleTextMode={() => setTextMode(m => m === "critical" ? "majority" : "critical")}
                onToggleHighlight={() => { setShowHighlighter(v => !v); setShowWandPopup(false); }}
                onToggleHebrew={() => { setHebrewMode(v => !v); setActiveWord(null); setShowWandPopup(false); }}
                onSetFontSize={(sz) => { setFontSize(sz); localStorage.setItem("rhema-font-size", String(sz)); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Breadcrumb trail ── */}
      {navHistory.length > 0 && (
        <div className="flex items-center px-4 py-1.5 border-b border-border-subtle/50 bg-bg-surface/50 shrink-0 overflow-x-auto gap-0 min-w-0">
          {navHistory.map((stop, idx) => (
            <span key={idx} className="flex items-center shrink-0">
              <button
                onClick={() => jumpToHistoryStop(idx)}
                className={cn(
                  "text-xs whitespace-nowrap px-1.5 py-1 transition-colors rounded-sm",
                  navCursor === idx
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-accent/70 hover:text-accent hover:bg-bg-elevated"
                )}
              >
                {BOOK_NAMES[stop.book] || stop.book} {stop.chapter}:{stop.verse}
              </button>
              <ChevronRight className="h-3 w-3 text-text-muted opacity-30 shrink-0" />
            </span>
          ))}
          <button
            onClick={jumpToEndpoint}
            className={cn(
              "text-xs whitespace-nowrap px-1.5 py-1 transition-colors rounded-sm shrink-0",
              navCursor === -1
                ? "bg-accent/15 text-text-primary font-semibold"
                : "text-text-primary font-medium hover:bg-bg-elevated"
            )}
          >
            {navEndpoint
              ? `${BOOK_NAMES[navEndpoint.book] || navEndpoint.book} ${navEndpoint.chapter}:${navEndpoint.verse}`
              : `${bookName} ${chapter}:${verse}`}
          </button>
          <button onClick={() => { setNavHistory([]); setNavCursor(-1); setNavEndpoint(null); }}
            className="ml-3 text-xs text-text-muted hover:text-danger transition-colors opacity-50 hover:opacity-100 shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* ── Highlight bar (inline, below breadcrumb) ── */}
      {showHighlighter && (
        <HighlighterBar
          intendedHighlights={intendedHighlights}
          activeHighlights={activeHighlights}
          versePosCats={versePosCats}
          shaking={shaking}
          isHebrew={isHebrew}
          onToggle={toggleHighlightCategory}
          onClearAll={() => setIntendedHighlights(new Set())}
          onClose={() => setShowHighlighter(false)}
        />
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {syntaxMode && !isHebrew ? (
            <SyntaxView
              book={book} chapter={chapter} verse={verse} textMode={textMode}
              onPhraseClick={(p) => { setSelectedSxPhrase(p); setActiveWord(null); setShowCrossRefs(false); setShowNotes(false); setShowLibrary(false); }}
              englishText={englishText} englishLabel={getEnglishLabel(textMode)}
            />
          ) : englishMode ? (
            <EnglishReaderView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} fullChapter={fullChapter} fontSize={fontSize}
              englishLabel={getEnglishLabel(textMode)}
              onTextModeToggle={() => setTextMode(m => m === "critical" ? "majority" : "critical")}
            />
          ) : phraseBuilderMode ? (
            <PhraseBuilderView
              book={book} chapter={chapter} verse={verse} textMode={textMode}
            />
          ) : fullChapter ? (
            <ChapterView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} greekOnly={greekOnly} showEnglish={showEnglish}
              activeWord={activeWord} activeHighlights={activeHighlights}
              isHebrew={isHebrew}
              onWordClick={(w) => { setActiveWord(w); setActiveTab("parsing"); closeAllPanels(); setActiveWord(w); }}
              englishLabel={getEnglishLabel(textMode)}
              fontSize={fontSize}
            />
          ) : (
            <VerseView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} greekOnly={greekOnly} showEnglish={showEnglish}
              activeWord={activeWord} activeHighlights={activeHighlights} variantSet={variantSet}
              isHebrew={isHebrew}
              onWordClick={(w) => { setActiveWord(w); setActiveTab("parsing"); closeAllPanels(); setActiveWord(w); }}
              englishText={englishText}
              englishLabel={getEnglishLabel(textMode)}
              fontSize={fontSize}
            />
          )}
        </div>

        {/* Right panels */}
        {selectedSxPhrase && !showCrossRefs && !showNotes && !showLibrary && (
          <SyntaxRolePanel phrase={selectedSxPhrase} onClose={() => setSelectedSxPhrase(null)} />
        )}
        {!selectedSxPhrase && activeWord && !showCrossRefs && !showNotes && !showLibrary && (
          <WordDetail
            word={activeWord} activeTab={activeTab} setActiveTab={setActiveTab}
            textMode={textMode} book={book} chapter={chapter} verse={verse}
            isHebrew={isHebrew}
            onClose={() => setActiveWord(null)}
            onNavigateOccurrence={handleNavigateOccurrence}
            onGrammarExample={(cat, val) => setGrammarModal({ category: cat, value: val })}
          />
        )}
        {showCrossRefs && (
          <CrossRefsPanel
            book={book} chapter={chapter} verse={verse}
            textMode={textMode}
            onClose={() => setShowCrossRefs(false)}
            onNavigate={(b, ch, v) => handleNavigateOccurrence(b, ch, v)}
            onSaveTrail={user ? saveXrefTrail : undefined}
          />
        )}
        {showLibrary && (
          <WordLibraryPanel
            query={libraryQuery}
            setQuery={setLibraryQuery}
            loaded={loaded}
            isHebrew={isHebrew}
            onSelectLex={(strongs, lex) => {
              const morph = isHebrew ? "" : findAnyMorphForStrongs(strongs);
              setActiveWord([(lex as LexEntry | HebrewLexEntry).lemma || "", strongs, morph]);
              setActiveTab("definition");
              setShowLibrary(false);
            }}
            onSelectForm={(strongs, surface, morph) => {
              setActiveWord([surface, strongs, morph]);
              setActiveTab("parsing");
              setShowLibrary(false);
            }}
            onClose={() => setShowLibrary(false)}
          />
        )}
        {showNotes && (
          <StudyWorkspacePanel
            book={book} chapter={chapter} verse={verse} textMode={textMode}
            isHebrew={isHebrew}
            activeTab={studyTab} onTabChange={setStudyTab}
            observations={observations} setObservations={setObservations}
            interpretations={interpretations} setInterpretations={setInterpretations}
            applications={applications} setApplications={setApplications}
            questions={questions} setQuestions={setQuestions}
            onClose={() => setShowNotes(false)}
            onHighlightWord={highlightWordFromNotes}
          />
        )}
      </div>

      {/* ── Book picker ── */}
      {bookPickerOpen && (
        <PickerOverlay onClose={() => { setBookPickerOpen(false); setBookSearch(""); }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Select Book</h3>
            <button onClick={() => { setBookPickerOpen(false); setBookSearch(""); }} className="text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <input value={bookSearch} onChange={e => setBookSearch(e.target.value)}
            placeholder="Search books…"
            className="w-full h-9 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-4 rounded-lg"
            autoFocus />
          {otBooks.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Old Testament</p>
                {hebrewAvailable() && (
                  <span className="text-[10px] text-accent opacity-70 font-mono">
                    {hebrewMode ? "Hebrew" : "LXX"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 mb-4">
                {otBooks.map(c => (
                  <button key={c} onClick={() => selectBook(c)}
                    className={cn("px-2 py-1.5 text-xs text-left transition-colors border rounded-lg",
                      c === book ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]")}>
                    {BOOK_NAMES[c] || c}
                  </button>
                ))}
              </div>
            </>
          )}
          {ntBooks.length > 0 && (
            <>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">New Testament</p>
              <div className="grid grid-cols-3 gap-1">
                {ntBooks.map(c => (
                  <button key={c} onClick={() => selectBook(c)}
                    className={cn("px-2 py-1.5 text-xs text-left transition-colors border rounded-lg",
                      c === book ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]")}>
                    {BOOK_NAMES[c] || c}
                  </button>
                ))}
              </div>
            </>
          )}
        </PickerOverlay>
      )}

      {/* ── Chapter picker ── */}
      {chPickerOpen && (
        <PickerOverlay onClose={() => setChPickerOpen(false)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Chapter — {bookName}</h3>
            <button onClick={() => setChPickerOpen(false)} className="text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {chapters.map(c => (
              <button key={c} onClick={() => selectChapter(c)}
                className={cn("h-9 text-sm font-medium border transition-colors rounded-lg",
                  c === chapter ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]")}>
                {c}
              </button>
            ))}
          </div>
        </PickerOverlay>
      )}

      {/* ── Verse picker ── */}
      {vPickerOpen && (
        <PickerOverlay onClose={() => setVPickerOpen(false)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">{bookName} {chapter} — Verse</h3>
            <button onClick={() => setVPickerOpen(false)} className="text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {verses.map(v => (
              <button key={v} onClick={() => selectVerse(v)}
                className={cn("h-9 text-sm font-medium border transition-colors rounded-lg",
                  v === verse ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]")}>
                {v}
              </button>
            ))}
          </div>
        </PickerOverlay>
      )}

      {/* ── Wand popup backdrop ── */}
      {showWandPopup && (
        <div className="fixed inset-0 z-[38]" onClick={() => setShowWandPopup(false)} />
      )}
      {/* ── Font picker backdrop ── */}
      {showFontPicker && (
        <div className="fixed inset-0 z-[38]" onClick={() => setShowFontPicker(false)} />
      )}

      {/* ── Grammar examples modal ── */}
      {grammarModal && (
        <GrammarExamplesModal
          category={grammarModal.category}
          value={grammarModal.value}
          onClose={() => setGrammarModal(null)}
        />
      )}
    </div>
  );
}

/* ── SyntaxView ─────────────────────────────────────────────── */
function SyntaxView({ book, chapter, verse, textMode, onPhraseClick, englishText, englishLabel }: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  onPhraseClick: (p: SxPhrase) => void;
  englishText: string; englishLabel: string;
}) {
  const words = getWords(book, chapter, verse, textMode);
  if (!words.length) return <p className="text-sm text-text-muted opacity-60">No verse data.</p>;
  const { tree, cats } = sxBuildTree(words, book, chapter, verse);
  const ref = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest">{ref}</p>
        <span className="text-xs text-text-muted opacity-50">Syntax Diagram</span>
      </div>
      <SyntaxBranch clause={tree} words={words} cats={cats} onPhraseClick={onPhraseClick} depth={0} />
      {englishText && (
        <div className="border-t border-border-subtle pt-5 mt-6">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">{englishLabel}</p>
          <p className="text-base text-text-muted leading-relaxed">{englishText}</p>
        </div>
      )}
    </div>
  );
}

function SyntaxBranch({ clause, words, cats, onPhraseClick, depth }: {
  clause: SxClause; words: Word[]; cats: SxCat[];
  onPhraseClick: (p: SxPhrase) => void; depth: number;
}) {
  const color = SX_CLAUSE_COLORS[clause.clauseType] || "#c9a84c";
  const subtitle = SX_CLAUSE_SUBTITLES[clause.clauseType];
  const isSynthetic = !clause.conjPhrase && !clause.phrases.length && clause.children.length > 0;

  if (isSynthetic) {
    return (
      <div className="flex flex-col gap-3">
        {clause.children.map((child, i) => (
          <SyntaxBranch key={i} clause={child} words={words} cats={cats} onPhraseClick={onPhraseClick} depth={depth} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", depth > 0 && "ml-8 pl-4 border-l-2")}
      style={{ borderColor: depth > 0 ? color : undefined }}>
      {/* Clause header */}
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color }}>{clause.label}</span>
        {subtitle && <span className="text-[11px] text-text-muted opacity-60">{subtitle}</span>}
      </div>
      {/* Phrase chips */}
      <div className="flex flex-wrap gap-2">
        {clause.phrases.map((p, i) => (
          <SyntaxPhraseChip key={i} phrase={p} words={words} cats={cats} onClick={() => onPhraseClick(p)} />
        ))}
      </div>
      {/* Children */}
      {clause.children.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          {clause.children.map((child, i) => (
            <SyntaxBranch key={i} clause={child} words={words} cats={cats} onPhraseClick={onPhraseClick} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SyntaxPhraseChip({ phrase, words, cats, onClick }: {
  phrase: SxPhrase; words: Word[]; cats: SxCat[]; onClick: () => void;
}) {
  const chip = SX_CHIP[phrase.color] || SX_CHIP.other;
  const greekWords = phrase.words.map(wi => words[wi]?.[0] || "").filter(Boolean);
  const glossWords = phrase.words.map(wi => {
    const w = words[wi];
    if (!w) return "";
    const lex = getLex(w[1]);
    return getWordGloss(lex, w[2]);
  }).filter(Boolean);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 px-2.5 py-2 border text-left transition-colors hover:opacity-80 min-w-0",
        chip.border, chip.bg
      )}
    >
      <span className={cn("text-[10px] font-semibold uppercase tracking-widest leading-none", chip.text)}>
        {phrase.plainLabel || phrase.label}
      </span>
      <span className="text-xl leading-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {greekWords.join(" ")}
      </span>
      {glossWords.length > 0 && (
        <span className="text-xs text-text-muted italic leading-tight">{glossWords.join(" ")}</span>
      )}
    </button>
  );
}

/* ── SyntaxRolePanel ─────────────────────────────────────────── */
function SyntaxRolePanel({ phrase, onClose }: { phrase: SxPhrase; onClose: () => void }) {
  const info = SX_ROLE_INFO[phrase.role] || SX_ROLE_INFO.unknown;
  const chip = SX_CHIP[phrase.color] || SX_CHIP.other;
  return (
    <div className="w-[320px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={cn("text-[10px] font-semibold uppercase tracking-widest", chip.text)}>
            {phrase.plainLabel || phrase.label}
          </span>
          <p className="text-xs font-semibold text-text-primary mt-1 leading-tight">{info.title}</p>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0 mt-0.5"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <p className="text-sm text-text-muted leading-relaxed">{info.body}</p>
        {info.range && (
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Range of meanings</p>
            <p className="text-sm text-text-muted leading-relaxed">{info.range}</p>
          </div>
        )}
        {info.example && (
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">English parallel</p>
            <p className="text-sm text-text-muted leading-relaxed italic">{info.example}</p>
          </div>
        )}
        <div className="p-3 bg-accent/5 border-l-2 border-accent/40">
          <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-1.5">For your study</p>
          <p className="text-sm text-text-primary leading-relaxed">{info.question}</p>
        </div>
      </div>
    </div>
  );
}

/* ── GrammarExamplesModal ───────────────────────────────────── */
const GRAMMAR_EXAMPLES: Record<string, Record<string, { title: string; en: string; body: string }>> = {
  tense: {
    "Present":     { title: "Present Tense",    en: '"He is writing" or "He writes"',                        body: "The present tense describes action happening now or as an ongoing habit. In Greek it emphasizes the continuous or repeated nature of the action. ὁ ἄνθρωπος γράφει — \"The man is writing (right now / habitually).\"" },
    "Imperfect":   { title: "Imperfect Tense",  en: '"He was writing"',                                      body: "The imperfect describes continuous or repeated action in past time. It paints a scene of ongoing activity. ἔγραφεν — \"He was writing (over and over, or for a period of time).\"" },
    "Aorist":      { title: "Aorist Tense",     en: '"He wrote" or "He wrote it (once)"',                    body: "The aorist views an action as a simple completed event without stressing duration. It's the default \"past tense\" of Greek narrative. ἔγραψεν — \"He wrote\" — a single point event." },
    "2nd Aorist":  { title: "2nd Aorist Tense", en: '"He threw" (irregular stem)',                           body: "Same meaning as the aorist — a completed past event — but the verb uses a different stem form (like English \"throw/threw\"). The grammar is identical; only the form differs." },
    "Perfect":     { title: "Perfect Tense",    en: '"He has written" (and the letter still exists)',         body: "The perfect describes a past completed action whose results are still felt now. λέλυκεν — \"He has loosed\" — it's done and the loosing matters now. Theologically powerful: τετέλεσται, \"It is finished.\"" },
    "2nd Perfect": { title: "2nd Perfect Tense",en: '"He has become" (irregular stem)',                      body: "Same meaning as the perfect — past action with present result — using an alternate stem. οἶδα (\"I know\") is technically a perfect-tense form meaning \"I have come to know = I know.\"" },
    "Pluperfect":  { title: "Pluperfect Tense", en: '"He had written" (before something else happened)',     body: "The pluperfect describes a completed action in the past whose result was felt at a prior past point. Rare in the NT. ᾔδει — \"He had known (before that moment).\"" },
    "Future":      { title: "Future Tense",     en: '"He will write"',                                      body: "The future describes expected or anticipated action. It can be predictive (will happen), deliberate (planning), or imperatival. σώσει — \"He will save.\"" },
  },
  voice: {
    "Active":           { title: "Active Voice",         en: '"Paul wrote the letter"',                              body: "The subject performs the action on something or someone outside itself. The most common voice. ἔγραψεν Παῦλος — Paul (subject) acted." },
    "Middle":           { title: "Middle Voice",         en: '"He washed himself" or "He had himself healed"',       body: "The subject participates in or benefits from the action. Often means the subject acts for its own interest. No exact English equivalent — sometimes translated active, sometimes reflexive." },
    "Passive":          { title: "Passive Voice",        en: '"He was healed" or "The letter was written"',          body: "The subject receives the action from an outside agent. ἐθεραπεύθη — \"He was healed (by someone).\" Greek passive is often used for divine action: \"was justified,\" \"was saved.\"" },
    "Middle/Deponent":  { title: "Middle/Deponent",      en: '"He answered" or "He came"',                           body: "Deponent verbs have middle or passive form but active meaning — they never appear in the active voice. ἔρχομαι — \"I come\" — looks middle/passive but means active. Common deponents: ἔρχομαι, ἀποκρίνομαι, γίνομαι." },
    "Middle-Passive":   { title: "Middle-Passive Voice", en: 'Could be "he washed himself" or "he was washed"',     body: "Some forms are identical in the middle and passive. Context and the tense system determine which is meant. In the present/imperfect, middle and passive forms are identical." },
    "Middle or Passive":{ title: "Middle or Passive",    en: 'Context determines: "he washed" or "he was washed"',  body: "Form is ambiguous between middle and passive. Check the tense, context, and lexical notes to determine which nuance applies." },
    "Middle Deponent":  { title: "Middle Deponent",      en: '"He asked" or "He came"',                              body: "A deponent using specifically the middle form. Active meaning, middle form. Common in NT Greek." },
  },
  mood: {
    "Indicative":  { title: "Indicative Mood",  en: '"He goes to the temple" (stating a fact)',           body: "The indicative asserts something as actual — a statement of reality. The most common mood. ὑπάγει — \"He goes.\" Negated with οὐ (not μή)." },
    "Subjunctive": { title: "Subjunctive Mood", en: '"that he might go" or "if he goes"',                  body: "The subjunctive expresses possibility, purpose, condition, or contingency. Always with ἵνα (purpose), ἐάν (if), or μή (prohibition). ἵνα σωθῶσιν — \"that they might be saved.\"" },
    "Optative":    { title: "Optative Mood",    en: '"May it never be!" (μὴ γένοιτο)',                    body: "The optative expresses a wish, prayer, or remote possibility. Rare in the NT (67 occurrences). Paul's famous μὴ γένοιτο — \"May it never be!\" / \"God forbid!\" — is optative." },
    "Imperative":  { title: "Imperative Mood",  en: '"Go!" or "Love one another!"',                       body: "The imperative gives a command or prohibition. 2nd person imperative is most common. ἀγαπᾶτε ἀλλήλους — \"Love one another!\" Prohibitions use μή + imperative or subjunctive." },
    "Infinitive":  { title: "Infinitive Mood",  en: '"to go" or "going"',                                 body: "The infinitive is a verbal noun — it can be a subject, object, or complement. θέλω πιστεύειν — \"I want to believe.\" Often used in purpose or result clauses." },
    "Participle":  { title: "Participle Mood",  en: '"the one going" or "while going"',                   body: "The participle is a verbal adjective — it has tense and voice like a verb, plus case/number/gender like a noun. It modifies nouns or expresses attendant circumstances. Often translated \"while Xing,\" \"after Xing,\" or \"the one who X.\"" },
  },
};

function GrammarExamplesModal({ category, value, onClose }: {
  category: string; value: string; onClose: () => void;
}) {
  const entry = GRAMMAR_EXAMPLES[category.toLowerCase()]?.[value];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-surface border border-border-subtle shadow-2xl w-full max-w-md rounded-2xl overflow-hidden animate-scaleIn">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">
            {entry?.title ?? `${value} — Grammar Example`}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-4 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5 flex flex-col gap-4">
          {entry ? (
            <>
              <p className="text-base text-accent font-medium italic">{entry.en}</p>
              <p className="text-sm text-text-muted leading-relaxed">{entry.body}</p>
            </>
          ) : (
            <p className="text-sm text-text-muted opacity-60">No example available for &ldquo;{value}&rdquo;.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── VerseView ──────────────────────────────────────────────── */
function VerseView({
  book, chapter, verse, textMode, greekOnly, showEnglish,
  activeWord, activeHighlights, variantSet, isHebrew, onWordClick, englishText, englishLabel, fontSize,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  greekOnly: boolean; showEnglish: boolean; activeWord: Word | null;
  activeHighlights: Set<string>; variantSet: Set<number>;
  isHebrew: boolean;
  onWordClick: (w: Word) => void;
  englishText: string; englishLabel: string;
  fontSize: FontSize;
}) {
  const words = getWords(book, chapter, verse, textMode, isHebrew);
  const ref = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
  const catConfig = isHebrew ? HEBREW_CATEGORY_CONFIG : CATEGORY_CONFIG;
  const normalizer = isHebrew ? normalizeHebrewPosKey : normalizePosKey;
  return (
    <div className="max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-7">
        <span className="text-xs font-semibold text-accent tracking-wide">{ref}</span>
        {isHebrew && <span className="text-[10px] text-accent/60 font-mono">Hebrew</span>}
      </div>
      <div className={cn(
        "flex flex-wrap gap-x-4 gap-y-5 mb-6",
        isHebrew && "flex-row-reverse",
        greekOnly && "gap-y-2"
      )}>
        {words.map((w, i) => {
          const cat = normalizer(w[2]);
          const hlConfig = cat && activeHighlights.has(cat) ? catConfig[cat] : null;
          return (
            <WordChip key={i} word={w} greekOnly={greekOnly}
              active={activeWord?.[0] === w[0] && activeWord?.[1] === w[1]}
              isVariant={!isHebrew && variantSet.has(i)}
              highlightConfig={hlConfig ?? null}
              isHebrew={isHebrew}
              fontSize={fontSize}
              onClick={() => onWordClick(w)}
            />
          );
        })}
      </div>
      {!greekOnly && showEnglish && (
        <div className="border-t border-border-subtle pt-5 mt-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">{englishLabel}</p>
          <p className={cn(FS_CONFIG[fontSize].english, "text-text-muted leading-relaxed")}>
            {englishText || <em className="opacity-50">Not included in this translation.</em>}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── ChapterView ────────────────────────────────────────────── */
function ChapterView({
  book, chapter, verse: targetVerse, textMode, greekOnly, showEnglish,
  activeWord, activeHighlights, isHebrew, onWordClick, englishLabel, fontSize,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  greekOnly: boolean; showEnglish: boolean; activeWord: Word | null;
  activeHighlights: Set<string>; isHebrew: boolean;
  onWordClick: (w: Word) => void;
  englishLabel: string;
  fontSize: FontSize;
}) {
  const verses = getVerses(book, chapter, textMode, isHebrew);
  const bookName = BOOK_NAMES[book] || book;
  const catConfig = isHebrew ? HEBREW_CATEGORY_CONFIG : CATEGORY_CONFIG;
  const normalizer = isHebrew ? normalizeHebrewPosKey : normalizePosKey;
  return (
    <div className="max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-7">
        <span className="text-xs font-semibold text-accent tracking-wide">{bookName} {chapter}</span>
        {isHebrew && <span className="text-[10px] text-accent/60 font-mono">Hebrew</span>}
      </div>
      {verses.map(v => {
        const words = getWords(book, chapter, v, textMode, isHebrew);
        const engText = getEnglishText(book, chapter, v, textMode);
        const isTarget = v === targetVerse;
        const variantSet = isHebrew ? new Set<number>() : getVariantSet(book, chapter, v, textMode);
        return (
          <div key={v} className={cn("mb-8 pb-6 border-b border-border-subtle/50", isTarget && "bg-accent/3 -mx-2 px-2 rounded")}>
            <span className="text-xs font-bold text-accent mr-2 select-none">{v}</span>
            <div className={cn(
              "inline-flex flex-wrap gap-x-4 gap-y-4 mt-2",
              isHebrew && "flex-row-reverse w-full justify-end",
              greekOnly && "gap-y-1"
            )}>
              {words.map((w, i) => {
                const cat = normalizer(w[2]);
                const hlConfig = cat && activeHighlights.has(cat) ? catConfig[cat] : null;
                return (
                  <WordChip key={i} word={w} greekOnly={greekOnly}
                    active={activeWord?.[0] === w[0] && activeWord?.[1] === w[1]}
                    isVariant={variantSet.has(i)}
                    highlightConfig={hlConfig ?? null}
                    isHebrew={isHebrew}
                    fontSize={fontSize}
                    onClick={() => onWordClick(w)}
                  />
                );
              })}
            </div>
            {!greekOnly && showEnglish && (
              <p className={cn(FS_CONFIG[fontSize].english, "text-text-muted leading-relaxed mt-3 pl-4 border-l border-border-subtle")}>
                {engText || ""}
                {engText && <span className="text-xs text-text-muted opacity-50 ml-2">{englishLabel}</span>}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── EnglishReaderView ──────────────────────────────────────── */
function EnglishReaderView({
  book, chapter, verse, textMode, fullChapter, fontSize, englishLabel, onTextModeToggle,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  fullChapter: boolean; fontSize: FontSize; englishLabel: string;
  onTextModeToggle: () => void;
}) {
  const bookName = BOOK_NAMES[book] || book;
  const chapters = getChapters(book, textMode);
  const verses   = fullChapter ? getVerses(book, chapter, textMode) : [verse];

  const lineSize = fontSize === 1 ? "text-base" : fontSize === 2 ? "text-lg" : fontSize === 3 ? "text-xl" : fontSize === 4 ? "text-2xl" : "text-3xl";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
          <span className="text-xs font-semibold text-accent tracking-wide">
            {bookName} {chapter}{fullChapter ? "" : `:${verse}`}
          </span>
          <span className="text-[10px] text-accent/60">{englishLabel}</span>
        </div>
        <button
          onClick={onTextModeToggle}
          className="text-[10px] px-2.5 py-1 border border-border-subtle rounded-lg text-text-muted hover:text-text-primary hover:border-[#3a4052] transition-colors"
        >
          Switch to {textMode === "critical" ? "MSB" : "BSB"}
        </button>
      </div>

      {/* Verse text */}
      {verses.map(v => {
        const text = getEnglishText(book, chapter, v, textMode);
        return (
          <p key={v} className={cn(lineSize, "text-text-primary leading-relaxed mb-4")}>
            {fullChapter && (
              <span className="text-xs font-bold text-accent mr-2 select-none align-super">{v}</span>
            )}
            {text || <em className="text-text-muted opacity-50 text-base">No translation available for this passage.</em>}
          </p>
        );
      })}
    </div>
  );
}

/* ── PhraseBuilderView ──────────────────────────────────────── */
interface PhraseRow {
  id: string;
  words: string[];
  x: number;          // px from canvas left
  y: number;          // px from canvas top
  verseLabel?: string;
}

/* Parse "Gen 5:8-13" / "John 3:16" / "1 Cor 13:1" etc. */
function parsePhraseRef(input: string): { book: string; ch: string; startV: number; endV: number } | null {
  const m = input.trim().match(/^(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?$/i);
  if (!m) return null;
  const raw = m[1].toLowerCase().replace(/\s+/g, " ").trim();
  const ch = m[2]; const startV = parseInt(m[3]); const endV = parseInt(m[4] || m[3]);
  for (const [abbr, name] of Object.entries(BOOK_NAMES)) {
    if (abbr.toLowerCase() === raw || name.toLowerCase() === raw ||
        name.toLowerCase().startsWith(raw) || abbr.toLowerCase().startsWith(raw)) {
      return { book: abbr, ch, startV, endV };
    }
  }
  return null;
}

function buildPhraseRows(book: string, ch: string, startV: number, endV: number, mode: TextMode): PhraseRow[] {
  const rows: PhraseRow[] = [];
  let y = 20;
  for (let v = startV; v <= Math.min(endV, startV + 29); v++) {
    const text = getEnglishText(book, ch, String(v), mode);
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length) {
      rows.push({ id: `${v}-${Date.now()}`, words, x: 24, y, verseLabel: String(v) });
      y += 62;
    }
  }
  return rows.length ? rows : [{ id: "0", words: [], x: 24, y: 20 }];
}

function PhraseBuilderView({
  book, chapter, verse, textMode,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
}) {
  const initialLabel = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
  const [refInput, setRefInput]       = useState(initialLabel);
  const [refError, setRefError]       = useState("");
  const [rows, setRows]               = useState<PhraseRow[]>(() => buildPhraseRows(book, chapter, parseInt(verse), parseInt(verse), textMode));
  const [activeLabel, setActiveLabel] = useState(initialLabel);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef<Map<string, HTMLDivElement>>(new Map());

  // Single-phrase drag
  const dragRef = useRef<{
    rowIdx: number; wordIdx: number;
    startX: number; startY: number;
    activated: boolean;
  } | null>(null);

  const [dragView, setDragView] = useState<{
    rowIdx: number; wordIdx: number;
    cursorX: number; cursorY: number;
  } | null>(null);

  // Box selection
  const selBoxRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const [selBox, setSelBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Group drag (moves all selected rows together)
  const groupDragRef = useRef<{
    startX: number; startY: number;
    activated: boolean;
    rowOffsets: Map<string, { ox: number; oy: number }>;
  } | null>(null);
  const [groupDelta, setGroupDelta] = useState<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const label = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
    setRefInput(label); setActiveLabel(label);
    setRows(buildPhraseRows(book, chapter, parseInt(verse), parseInt(verse), textMode));
    setRefError("");
    setSelectedIds(new Set());
  }, [book, chapter, verse, textMode]);

  function loadRef() {
    const parsed = parsePhraseRef(refInput);
    if (!parsed) { setRefError("Couldn't parse reference. Try: \"Gen 5:8-13\""); return; }
    const newRows = buildPhraseRows(parsed.book, parsed.ch, parsed.startV, parsed.endV, textMode);
    if (!newRows[0].words.length) { setRefError("No English text found for that reference."); return; }
    setRows(newRows); setRefError(""); setSelectedIds(new Set());
    const end = parsed.startV === parsed.endV ? "" : `–${parsed.endV}`;
    setActiveLabel(`${BOOK_NAMES[parsed.book] || parsed.book} ${parsed.ch}:${parsed.startV}${end}`);
  }

  // ── Box selection handlers (canvas background) ──
  function onCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== containerRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + containerRef.current!.scrollTop;
    selBoxRef.current = { startX: x, startY: y, active: false };
    setSelBox(null);
  }

  function onCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const sb = selBoxRef.current;
    if (!sb) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + containerRef.current!.scrollTop;
    const dx = x - sb.startX, dy = y - sb.startY;
    if (!sb.active && Math.sqrt(dx * dx + dy * dy) < 6) return;
    sb.active = true;
    setSelBox({
      x1: Math.min(sb.startX, x), y1: Math.min(sb.startY, y),
      x2: Math.max(sb.startX, x), y2: Math.max(sb.startY, y),
    });
  }

  function onCanvasPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const sb = selBoxRef.current;
    if (!sb) return;
    selBoxRef.current = null;
    const box = selBox;
    setSelBox(null);
    if (!sb.active || !box) return;

    const containerEl = containerRef.current!;
    const containerRect = containerEl.getBoundingClientRect();
    const newSelected = new Set<string>();
    rowEls.current.forEach((rowEl, rowId) => {
      const rRect = rowEl.getBoundingClientRect();
      const rx1 = rRect.left - containerRect.left;
      const ry1 = rRect.top - containerRect.top + containerEl.scrollTop;
      const rx2 = rx1 + rRect.width;
      const ry2 = ry1 + rRect.height;
      if (rx2 > box.x1 && rx1 < box.x2 && ry2 > box.y1 && ry1 < box.y2) {
        newSelected.add(rowId);
      }
    });
    setSelectedIds(newSelected);
  }

  // ── Word drag handlers ──
  function onWordPointerDown(e: React.PointerEvent, rIdx: number, wIdx: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rowId = rows[rIdx]?.id;

    // If this row is part of the selection, start a group drag
    if (rowId && selectedIds.has(rowId)) {
      const offsets = new Map<string, { ox: number; oy: number }>();
      const anchorRow = rows[rIdx];
      rows.forEach(r => {
        if (selectedIds.has(r.id)) {
          offsets.set(r.id, { ox: r.x - anchorRow.x, oy: r.y - anchorRow.y });
        }
      });
      groupDragRef.current = { startX: e.clientX, startY: e.clientY, activated: false, rowOffsets: offsets };
      return;
    }

    dragRef.current = { rowIdx: rIdx, wordIdx: wIdx, startX: e.clientX, startY: e.clientY, activated: false };
  }

  function onWordPointerMove(e: React.PointerEvent, rIdx: number, wIdx: number) {
    // Group drag
    const gd = groupDragRef.current;
    if (gd) {
      const dx = e.clientX - gd.startX, dy = e.clientY - gd.startY;
      if (!gd.activated && Math.sqrt(dx * dx + dy * dy) < 8) return;
      gd.activated = true;
      setGroupDelta({ dx, dy });
      return;
    }

    // Single drag
    const d = dragRef.current;
    if (!d || d.rowIdx !== rIdx || d.wordIdx !== wIdx) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.activated && Math.sqrt(dx * dx + dy * dy) < 8) return;
    d.activated = true;
    setDragView({ rowIdx: rIdx, wordIdx: wIdx, cursorX: e.clientX, cursorY: e.clientY });
  }

  function onWordPointerUp(e: React.PointerEvent, rIdx: number, wIdx: number) {
    // Group drag finish
    const gd = groupDragRef.current;
    if (gd) {
      const wasActivated = gd.activated;
      groupDragRef.current = null;
      setGroupDelta(null);
      if (wasActivated) {
        const dx = e.clientX - gd.startX;
        const dy = e.clientY - gd.startY;
        setRows(prev => prev.map(r => {
          if (!selectedIds.has(r.id)) return r;
          return { ...r, x: Math.max(0, r.x + dx), y: Math.max(0, r.y + dy) };
        }));
        setSelectedIds(new Set());
      }
      return;
    }

    // Single drag finish
    const d = dragRef.current;
    if (!d) return;
    const wasActivated = d.activated;
    dragRef.current = null;
    const dv = dragView;
    setDragView(null);
    if (!wasActivated || !dv) return;

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dropX = Math.max(0, e.clientX - rect.left - 14);
    const dropY = Math.max(0, e.clientY - rect.top + el.scrollTop - 16);

    setRows(prev => {
      const next = [...prev];
      const row = next[rIdx];
      if (dv.wordIdx > 0) {
        next[rIdx] = { ...row, words: row.words.slice(0, dv.wordIdx) };
        next.push({ id: Date.now().toString(36), words: row.words.slice(dv.wordIdx), x: dropX, y: dropY });
      } else {
        next[rIdx] = { ...row, x: dropX, y: dropY };
      }
      return next.filter(r => r.words.length > 0);
    });
  }

  const canvasHeight = rows.reduce((m, r) => Math.max(m, r.y + 100), 600);
  const isEmpty = rows.every(r => r.words.length === 0);

  return (
    <div className="w-full flex flex-col" style={{ height: "calc(100vh - 160px)" }}>

      {/* ── Reference picker — compact strip ── */}
      <div className="flex items-center gap-2 flex-wrap mb-4 shrink-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 shrink-0">
          <Columns2 className="h-3 w-3 text-accent" />
          <span className="text-xs font-semibold text-accent tracking-wide">{activeLabel}</span>
        </div>
        <input
          value={refInput}
          onChange={e => { setRefInput(e.target.value); setRefError(""); }}
          onKeyDown={e => e.key === "Enter" && loadRef()}
          placeholder="Gen 5:8-13 or John 3:16-17"
          className="h-7 w-48 bg-bg-elevated border border-border-subtle px-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent rounded-lg"
        />
        <button onClick={loadRef} className="h-7 px-3 text-xs border border-border-subtle text-text-muted hover:border-accent hover:text-accent transition-colors rounded-lg shrink-0">Load</button>
        <button
          onClick={() => {
            const label = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
            setRefInput(label); setActiveLabel(label);
            setRows(buildPhraseRows(book, chapter, parseInt(verse), parseInt(verse), textMode));
            setRefError(""); setSelectedIds(new Set());
          }}
          className="h-7 px-2 text-xs border border-border-subtle text-text-muted hover:text-text-primary transition-colors rounded-lg shrink-0"
        >Reset</button>
        {refError && <span className="text-xs text-red-400">{refError}</span>}
      </div>

      {/* ── Ghost overlay (single drag) ── */}
      {dragView && (() => {
        const ghostWords = rows[dragView.rowIdx]?.words.slice(dragView.wordIdx) ?? [];
        return (
          <div
            className="fixed pointer-events-none z-50 drop-shadow-2xl"
            style={{ left: dragView.cursorX - 14, top: dragView.cursorY - 16, transform: "rotate(-0.4deg)" }}
          >
            <div className="flex flex-wrap gap-x-[0.4em] text-2xl font-serif text-text-primary/75 leading-snug">
              {ghostWords.map((w, i) => <span key={i}>{w}</span>)}
            </div>
          </div>
        );
      })()}

      {/* ── Free-form canvas ── */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto select-none rounded-xl border border-border-subtle/30"
        style={{ minHeight: `${canvasHeight}px` }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
      >
        {isEmpty && (
          <p className="absolute top-8 left-6 text-sm text-text-muted opacity-40">No text found for this passage.</p>
        )}
        {/* Box selection rectangle */}
        {selBox && (
          <div
            className="absolute pointer-events-none border-2 border-dashed border-accent/60 bg-accent/5 rounded"
            style={{ left: selBox.x1, top: selBox.y1, width: selBox.x2 - selBox.x1, height: selBox.y2 - selBox.y1 }}
          />
        )}
        {rows.map((row, rIdx) => {
          const isSelected = selectedIds.has(row.id);
          const gDelta = groupDelta && isSelected ? groupDelta : null;
          return (
          <div
            key={row.id}
            ref={(el) => { if (el) rowEls.current.set(row.id, el); else rowEls.current.delete(row.id); }}
            className={cn(
              "absolute flex flex-wrap items-baseline gap-x-[0.4em] gap-y-0 rounded-md",
              isSelected && "ring-1 ring-accent/40 bg-accent/5 px-1"
            )}
            style={{
              left: row.x + (gDelta?.dx ?? 0),
              top: row.y + (gDelta?.dy ?? 0),
              opacity: dragView?.rowIdx === rIdx ? 0.1 : 1,
              transition: gDelta ? "none" : "opacity 80ms",
            }}
          >
            {row.verseLabel && (
              <span className="text-[9px] font-bold text-accent/40 mr-0.5 self-center select-none tabular-nums">
                {row.verseLabel}
              </span>
            )}
            {row.words.map((word, wIdx) => (
              <span
                key={wIdx}
                className="cursor-phrase text-2xl font-serif hover:text-accent/70 transition-colors duration-75 touch-none leading-snug"
                onPointerDown={e => onWordPointerDown(e, rIdx, wIdx)}
                onPointerMove={e => onWordPointerMove(e, rIdx, wIdx)}
                onPointerUp={e => onWordPointerUp(e, rIdx, wIdx)}
              >
                {word}
              </span>
            ))}
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── WordChip ───────────────────────────────────────────────── */
type CategoryStyle = typeof CATEGORY_CONFIG[string];

function WordChip({
  word, greekOnly, active, isVariant, highlightConfig, isHebrew, fontSize, onClick,
}: {
  word: Word; greekOnly: boolean; active: boolean;
  isVariant: boolean;
  highlightConfig: CategoryStyle | null;
  isHebrew?: boolean;
  fontSize: FontSize;
  onClick: () => void;
}) {
  const [surface, strongs, morph] = word;
  const gloss = isHebrew
    ? getHebrewWordGloss(getHebrewLex(strongs), morph)
    : getWordGloss(getLex(strongs), morph);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1 px-2 pt-1.5 pb-3 border transition-colors duration-100 group rounded-lg",
        active
          ? "border-accent bg-accent/10"
          : highlightConfig
          ? cn(highlightConfig.border, highlightConfig.bg)
          : "border-transparent hover:border-border-subtle hover:bg-bg-elevated"
      )}
    >
      <span
        className={cn(
          FS_CONFIG[fontSize].chip, "leading-tight select-none",
          active ? "text-accent"
            : highlightConfig ? highlightConfig.text
            : "text-text-primary group-hover:text-accent"
        )}
        style={{
          fontFamily: isHebrew
            ? "'Noto Serif Hebrew', 'SBL Hebrew', 'David', 'Times New Roman', serif"
            : "Georgia, 'Times New Roman', serif",
          direction: isHebrew ? "rtl" : "ltr",
          lineHeight: isHebrew ? "1.6" : "1.3",
        }}
      >
        {surface}
      </span>
      {!greekOnly && gloss && (
        <span className={cn(FS_CONFIG[fontSize].gloss, "leading-tight text-center whitespace-normal max-w-[110px]",
          highlightConfig ? highlightConfig.text + " opacity-80" : "text-text-muted")}>
          {gloss}
        </span>
      )}
    </button>
  );
}

/* ── WordDetail panel ───────────────────────────────────────── */
function WordDetail({
  word, activeTab, setActiveTab, textMode, book, chapter, verse, isHebrew, onClose, onNavigateOccurrence, onGrammarExample,
}: {
  word: Word; activeTab: ActiveTab; setActiveTab: (t: ActiveTab) => void;
  textMode: TextMode; book: string; chapter: string; verse: string;
  isHebrew: boolean;
  onClose: () => void;
  onNavigateOccurrence: (book: string, ch: string, v: string) => void;
  onGrammarExample: (category: string, value: string) => void;
}) {
  const [surface, strongs, morph] = word;
  const lex = isHebrew ? getHebrewLex(strongs) : getLex(strongs);
  const words = getWords(book, chapter, verse, textMode, isHebrew);
  const wordIdx = words.findIndex(w => w[0] === surface && w[1] === strongs && w[2] === morph);
  const strongs_label = isHebrew ? `H${strongs}` : (strongs ? `G${strongs}` : "LXX");
  const inflected = isHebrew ? (lex as HebrewLexEntry).translit || "" : getWordGloss(lex as LexEntry, morph);
  const scriptFont = isHebrew
    ? "'Noto Serif Hebrew', 'SBL Hebrew', 'David', 'Times New Roman', serif"
    : "Georgia, 'Times New Roman', serif";

  const { user } = useAuthContext();
  const [wordNote, setWordNote] = useState("");
  const [wordNoteSaving, setWordNoteSaving] = useState(false);
  const [wordNoteSaved, setWordNoteSaved] = useState(false);

  useEffect(() => {
    if (!user || !strongs) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, "rhema_word_notes", user.uid, "words", String(strongs));
        const snap = await getDoc(ref);
        if (!cancelled) setWordNote(snap.exists() ? (snap.data().note || "") : "");
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user, strongs]);

  async function saveWordNote() {
    if (!user || !strongs) return;
    setWordNoteSaving(true);
    try {
      const ref = doc(db, "rhema_word_notes", user.uid, "words", String(strongs));
      await setDoc(ref, { note: wordNote, lemma: lex.lemma, updatedAt: new Date() });
      setWordNoteSaved(true);
      setTimeout(() => setWordNoteSaved(false), 2000);
    } catch { /* ignore */ }
    setWordNoteSaving(false);
  }

  return (
    <div className="w-[340px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden animate-slideInRight">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span
              className="text-3xl text-text-primary leading-none"
              style={{ fontFamily: scriptFont, direction: isHebrew ? "rtl" : "ltr", lineHeight: isHebrew ? "1.5" : "1" }}
            >{surface}</span>
            <span className="text-xs text-text-muted font-mono opacity-60">{strongs_label}</span>
            {isHebrew && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded font-semibold">Hebrew</span>}
          </div>
          {lex.lemma && (
            <p className="text-sm text-accent" style={{ fontFamily: scriptFont, direction: isHebrew ? "rtl" : "ltr" }}>
              {lex.lemma}
              {(lex as LexEntry).translit
                ? <span className="text-xs text-text-muted italic font-sans ml-2" style={{ direction: "ltr" }}>{(lex as LexEntry).translit}</span>
                : null
              }
            </p>
          )}
          {inflected && (
            <p className="text-xs text-text-muted mt-1.5 px-2.5 py-1 bg-bg-elevated border border-accent/20 rounded-lg italic">
              &ldquo;{inflected}&rdquo;
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0 mt-0.5"><X className="h-4 w-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {(["parsing","definition","occurrences","note"] as ActiveTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-2 text-[10px] font-medium transition-colors border-b-2",
              activeTab === tab ? "text-text-primary border-accent" : "text-text-muted border-transparent hover:text-text-primary")}>
            {tab === "occurrences" ? "Uses" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "parsing" && (
          isHebrew
            ? <HebrewParsingTab surface={surface} strongs={strongs} morph={morph} />
            : <ParsingTab surface={surface} strongs={strongs} morph={morph}
                book={book} chapter={chapter} verse={verse} wordIdx={wordIdx}
                onGrammarExample={onGrammarExample} />
        )}
        {activeTab === "definition" && (
          isHebrew
            ? <HebrewDefinitionTab strongs={strongs} />
            : <DefinitionTab strongs={strongs} morph={morph} />
        )}
        {activeTab === "occurrences" && (
          <OccurrencesTab strongs={strongs} textMode={textMode} isHebrew={isHebrew} onNavigate={onNavigateOccurrence} />
        )}
        {activeTab === "note" && (
          <div className="flex flex-col gap-3 h-full">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              Word study note — follows this word ({strongs_label}) everywhere it appears
            </p>
            <textarea
              value={wordNote}
              onChange={e => setWordNote(e.target.value)}
              placeholder={`Notes on ${lex.lemma || surface}…`}
              className="flex-1 w-full bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent leading-relaxed"
              style={{ minHeight: "180px" }}
            />
            <button onClick={saveWordNote} disabled={wordNoteSaving}
              className={cn("w-full h-9 flex items-center justify-center gap-2 text-xs font-medium border transition-colors disabled:opacity-60 rounded-lg",
                wordNoteSaved ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary")}>
              {wordNoteSaved ? <><Check className="h-3.5 w-3.5" /> Saved</>
                : wordNoteSaving ? <><div className="h-3.5 w-3.5 border border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
                : <><Save className="h-3.5 w-3.5" /> Save Word Note</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ParsingTab ─────────────────────────────────────────────── */
const GRAMMAR_CLICKABLE: Record<string, Set<string>> = {
  Tense: new Set(["Present","Imperfect","Aorist","2nd Aorist","Perfect","2nd Perfect","Pluperfect","Future"]),
  Voice: new Set(["Active","Middle","Passive","Middle/Deponent","Middle-Passive","Middle or Passive","Middle Deponent"]),
  Mood:  new Set(["Indicative","Subjunctive","Optative","Imperative","Infinitive","Participle"]),
};

function extractWordEnding(surface: string, lemma: string): { stem: string; ending: string } | null {
  if (!surface || !lemma) return null;
  let i = 0;
  while (i < surface.length && i < lemma.length && surface[i] === lemma[i]) i++;
  if (i === 0) return null;
  return { stem: surface.slice(0, i), ending: surface.slice(i) };
}

function ParsingTab({ surface, strongs, morph, book, chapter, verse, wordIdx, onGrammarExample }: {
  surface: string; strongs: number; morph: string;
  book: string; chapter: string; verse: string; wordIdx: number;
  onGrammarExample: (category: string, value: string) => void;
}) {
  const rows: MorphRow[] = decodeMorph(morph);
  const lex = getLex(strongs);
  const sxEntry = window.RhemaSyntax?.[book]?.[chapter]?.[verse]?.find(([pos, str]) => pos - 1 === wordIdx && str === strongs);
  const syntaxRole = sxEntry?.[2];

  if (!rows.length) {
    return <p className="text-sm text-text-muted opacity-60">No parsing data for &ldquo;{morph}&rdquo;.</p>;
  }

  /* Form hint: stem + bold ending */
  let formHint: string | null = null;
  const posRaw = morph.split("-")[0];
  if (posRaw !== "V") {
    const caseRow = rows.find(r => r.label === "Case");
    if (caseRow) {
      const numRow = rows.find(r => r.label === "Number");
      const parsed = extractWordEnding(surface, lex.lemma || "");
      const caseLabel = [caseRow.value, numRow?.value].filter(Boolean).join(" ");
      formHint = parsed?.ending
        ? `${parsed.stem}‑${parsed.ending} → ${caseLabel}`
        : `${surface} → ${caseLabel}`;
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {rows.map((row, i) => {
        const isClickable = GRAMMAR_CLICKABLE[row.label]?.has(row.value);
        return (
          <div key={i} className="flex items-start justify-between py-2 border-b border-border-subtle/50 last:border-0">
            <span className="text-xs text-text-muted w-28 shrink-0">{row.label}</span>
            <div className="text-right">
              {isClickable ? (
                <button
                  onClick={() => onGrammarExample(row.label.toLowerCase(), row.value)}
                  className="text-sm text-accent font-medium hover:text-accent-hover transition-colors underline decoration-dotted underline-offset-2"
                  title={`See example of ${row.value}`}
                >
                  {row.value}
                </button>
              ) : (
                <span className="text-sm text-text-primary font-medium">{row.value}</span>
              )}
              {row.desc && <p className="text-xs text-text-muted mt-0.5">{row.desc}</p>}
            </div>
          </div>
        );
      })}
      {syntaxRole && (
        <div className="flex items-start justify-between py-2 border-b border-border-subtle/50">
          <span className="text-xs text-text-muted w-28 shrink-0">Syntax Role</span>
          <span className="text-sm text-text-primary font-medium text-right">{syntaxRole}</span>
        </div>
      )}
      {formHint && (
        <div className="mt-3 pt-3 border-t border-border-subtle/50">
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Form</p>
          <p className="text-sm font-mono text-text-muted" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{formHint}</p>
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-border-subtle/50">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Morph Code</p>
        <p className="text-xs font-mono text-text-muted opacity-60">{morph || "—"}</p>
      </div>
    </div>
  );
}

/* ── DefinitionTab ──────────────────────────────────────────── */
function DefinitionTab({ strongs, morph }: { strongs: number; morph: string }) {
  const lex = getLex(strongs);
  if (!lex.lemma && !lex.brief) {
    return <p className="text-sm text-text-muted opacity-60">No definition found.</p>;
  }

  const inflected = morph ? getWordGloss(lex, morph) : "";
  const quickRaw = lex.quick_def || lex.brief || "";
  const quickClean = quickRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const quickDisplay = inflected || quickClean;

  // KJV semantic range chips
  const kjvGlosses = (lex.kjv_def || "")
    .split(",")
    .map(g => g.replace(/[()]/g, "").replace(/^[X+]\s*/, "").trim())
    .filter(g => g.length > 1 && !/^\d+$/.test(g));

  const sections: { label: string; content: string; note?: string }[] = [];
  if (lex.abbott_smith) sections.push({
    label: "Abbott-Smith",
    content: lex.abbott_smith,
    note: "Manual Greek Lexicon of the NT (1922) — scholarly, concise definitions with LXX usage",
  });
  if (lex.moulton_milligan) sections.push({
    label: "Moulton & Milligan",
    content: lex.moulton_milligan,
    note: "Vocabulary of the Greek NT (1930) — how this word was used in everyday papyri & documents",
  });
  if (lex.extended || lex.brief) sections.push({
    label: "Dodson",
    content: (lex.extended || lex.brief)!,
    note: "Public domain Greek–English lexicon",
  });
  if (lex.strongs_def) sections.push({
    label: "Strong's",
    content: lex.strongs_def,
    note: "Exhaustive Concordance (1890) — widely used reference; numbered G" + strongs,
  });
  if (lex.deriv) sections.push({ label: "Etymology", content: lex.deriv });

  return (
    <div className="flex flex-col gap-5">
      {/* Inflected / quick gloss */}
      {quickDisplay && (
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
          <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-1">
            {inflected ? "Inflected Gloss" : "Core Meaning"}
          </p>
          <p className="text-sm text-text-primary leading-relaxed italic">&ldquo;{quickDisplay}&rdquo;</p>
          {inflected && quickClean && quickClean !== inflected && (
            <p className="text-xs text-text-muted mt-1 not-italic">{quickClean}</p>
          )}
        </div>
      )}

      {/* KJV semantic range */}
      {kjvGlosses.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">English Translations (KJV range)</p>
          <div className="flex flex-wrap gap-1.5">
            {kjvGlosses.slice(0, 14).map((g, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-bg-elevated border border-border-subtle rounded-full text-text-primary">
                {g}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-2 leading-relaxed opacity-70">
            The range of English words used for this Greek word shows its semantic breadth.
          </p>
        </div>
      )}

      {sections.length > 0 && <div className="border-t border-border-subtle/50" />}

      {/* Lexicon sections */}
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-0.5">{s.label}</p>
          {s.note && <p className="text-[10px] text-text-muted opacity-60 mb-1.5 italic">{s.note}</p>}
          <div className="text-sm text-text-primary leading-relaxed" dangerouslySetInnerHTML={{ __html: s.content }} />
          {i < sections.length - 1 && <div className="mt-4 border-b border-border-subtle/50" />}
        </div>
      ))}

      {/* Study note */}
      <div className="p-3 bg-bg-elevated border border-border-subtle/50 rounded-xl">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Study Note</p>
        <p className="text-xs text-text-muted leading-relaxed">
          Multiple lexicons give you a fuller picture — Abbott-Smith is great for scholarly depth, Moulton &amp; Milligan shows real-world usage, and Strong&apos;s (<span className="font-mono text-text-primary">G{strongs}</span>) is the standard cross-reference number used in most concordances and Bible software.
        </p>
      </div>
    </div>
  );
}

/* ── HebrewParsingTab ────────────────────────────────────────── */
function HebrewParsingTab({ surface, strongs, morph }: { surface: string; strongs: number; morph: string }) {
  const rows: HebrewMorphRow[] = decodeHebrewMorph(morph);
  if (!rows.length) {
    return <p className="text-sm text-text-muted opacity-60">No parsing data for &ldquo;{morph || surface}&rdquo;.</p>;
  }
  return (
    <div className="flex flex-col gap-0">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start justify-between py-2 border-b border-border-subtle/50 last:border-0">
          <span className="text-xs text-text-muted w-28 shrink-0">{row.label}</span>
          <div className="text-right min-w-0 flex-1 ml-2">
            <span className="text-sm text-text-primary font-medium">{row.value}</span>
            {row.desc && <p className="text-xs text-text-muted mt-0.5">{row.desc}</p>}
          </div>
        </div>
      ))}
      <div className="mt-3 pt-3 border-t border-border-subtle/50">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Strong&apos;s</p>
        <p className="text-xs font-mono text-text-muted">H{strongs}</p>
      </div>
      <div className="mt-2">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Morph Code</p>
        <p className="text-xs font-mono text-text-muted opacity-60">{morph || "—"}</p>
      </div>
    </div>
  );
}

/* ── HebrewDefinitionTab ─────────────────────────────────────── */
function HebrewDefinitionTab({ strongs }: { strongs: number }) {
  const lex = getHebrewLex(strongs);
  if (!lex.lemma && !lex.brief && !lex.strongs_def) {
    return <p className="text-sm text-text-muted opacity-60">No definition found (H{strongs}).</p>;
  }

  const quickClean = (lex.brief || lex.quick_def || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  // KJV glosses as individual translation chips — strip Strong's markup (X prefix, + signs)
  const kjvGlosses = (lex.kjv_def || "")
    .split(",")
    .map(g => g.replace(/[()]/g, "").replace(/^[X+]\s*/, "").trim())
    .filter(g => g.length > 1 && !/^\d+$/.test(g));

  const strDef = (lex.strongs_def || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const extDef = (lex.extended || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const showExtended = extDef && extDef !== strDef;

  return (
    <div className="flex flex-col gap-5">
      {/* Core meaning */}
      {quickClean && (
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
          <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-1">Core Meaning</p>
          <p className="text-sm text-text-primary leading-relaxed italic">&ldquo;{quickClean}&rdquo;</p>
        </div>
      )}

      {/* Hebrew word + pronunciation */}
      {lex.lemma && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">Hebrew Word</p>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-3xl text-text-primary leading-snug"
              style={{ fontFamily: "'Noto Serif Hebrew','SBL Hebrew','David','Times New Roman',serif", direction: "rtl" }}>
              {lex.lemma}
            </p>
            {lex.pronounce && (
              <div>
                <p className="text-base text-text-primary font-medium tracking-wide">{lex.pronounce}</p>
                <p className="text-[10px] text-text-muted mt-0.5">pronunciation</p>
              </div>
            )}
          </div>
          {lex.translit && <p className="text-sm text-text-muted italic mt-1.5">{lex.translit}</p>}
        </div>
      )}

      {/* KJV semantic range */}
      {kjvGlosses.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">English Translations (KJV range)</p>
          <div className="flex flex-wrap gap-1.5">
            {kjvGlosses.slice(0, 14).map((g, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-bg-elevated border border-border-subtle rounded-full text-text-primary">
                {g}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-2 leading-relaxed opacity-70">
            One Hebrew word often carries several English meanings depending on context — this range shows the full breadth.
          </p>
        </div>
      )}

      <div className="border-t border-border-subtle/50" />

      {/* Strong's definition */}
      {strDef && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Strong&apos;s Hebrew Dictionary</p>
          <p className="text-sm text-text-primary leading-relaxed">{strDef}</p>
        </div>
      )}

      {/* Extended (if differs from Strong's) */}
      {showExtended && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Additional Notes</p>
          <p className="text-sm text-text-primary leading-relaxed">{extDef}</p>
        </div>
      )}

      {/* Etymology / root */}
      {lex.deriv && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Root / Etymology</p>
          <p className="text-sm text-text-primary leading-relaxed">{lex.deriv}</p>
        </div>
      )}

      {/* Study guidance for beginners */}
      <div className="p-3 bg-bg-elevated border border-border-subtle/50 rounded-xl">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Study Note</p>
        <p className="text-xs text-text-muted leading-relaxed">
          Hebrew words carry richer meaning than any single English word can capture. Read the full range of translations above, consider the context of this passage, and let the root meaning inform your understanding. Strong&apos;s number <span className="font-mono text-text-primary">H{strongs}</span> lets you look this word up in other study tools like concordances or commentaries.
        </p>
      </div>
    </div>
  );
}

/* ── OccurrencesTab ─────────────────────────────────────────── */
function OccurrencesTab({ strongs, textMode, isHebrew, onNavigate }: {
  strongs: number; textMode: TextMode; isHebrew: boolean;
  onNavigate: (book: string, ch: string, v: string) => void;
}) {
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const occ = getOccurrences(strongs, textMode, isHebrew);
  if (!occ.total) return <p className="text-sm text-text-muted opacity-60">No occurrences found.</p>;
  const bookList = getBookOrder(textMode, isHebrew).filter(b => occ.books[b]);
  return (
    <div>
      <p className="text-xs text-text-muted mb-3">
        Appears <span className="text-accent font-semibold">{occ.total}</span>× in {isHebrew ? "Hebrew OT" : "Rhema"}
      </p>
      <div className="flex flex-col gap-0.5">
        {bookList.map(bk => (
          <div key={bk}>
            <button
              onClick={() => setExpandedBook(expandedBook === bk ? null : bk)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <span className="font-medium">{BOOK_NAMES[bk] || bk}</span>
              <span className="text-accent">{occ.books[bk]}×</span>
            </button>
            {expandedBook === bk && (
              <BookOccurrences book={bk} strongs={strongs} textMode={textMode} isHebrew={isHebrew}
                onNavigate={(ch, v) => onNavigate(bk, ch, v)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookOccurrences({ book, strongs, textMode, isHebrew, onNavigate }: {
  book: string; strongs: number; textMode: TextMode; isHebrew: boolean;
  onNavigate: (ch: string, v: string) => void;
}) {
  const bookText = isHebrew && window.RhemaHebrewOT
    ? (window.RhemaHebrewOT.text[book] || {})
    : (getText(textMode)[book] || {});
  const scriptFont = isHebrew
    ? "'Noto Serif Hebrew','SBL Hebrew','David','Times New Roman',serif"
    : "Georgia, 'Times New Roman', serif";
  const refs: { ch: string; v: string; words: Word[] }[] = [];
  for (const ch of Object.keys(bookText).sort((a, b) => Number(a) - Number(b))) {
    for (const v of Object.keys(bookText[ch]).sort((a, b) => Number(a) - Number(b))) {
      const words: Word[] = bookText[ch][v];
      if (words.some((w: Word) => w[1] === strongs)) refs.push({ ch, v, words });
    }
  }
  return (
    <div className="ml-2 border-l border-border-subtle pl-2 mb-2">
      {refs.map(({ ch, v, words }) => {
        const preview = words.map((w: Word) =>
          w[1] === strongs ? `<span style="color:#c9a84c;font-weight:600">${w[0]}</span>` : w[0]
        ).join(isHebrew ? "‏ " : " ");
        return (
          <button key={`${ch}:${v}`} onClick={() => onNavigate(ch, v)}
            className="w-full text-left px-2 py-1.5 hover:bg-bg-elevated transition-colors border-b border-border-subtle/30 last:border-0">
            <p className="text-xs text-accent font-semibold mb-0.5">{ch}:{v}</p>
            <p className="text-sm text-text-muted leading-relaxed"
              style={{ fontFamily: scriptFont, direction: isHebrew ? "rtl" : "ltr" }}
              dangerouslySetInnerHTML={{ __html: preview }} />
          </button>
        );
      })}
    </div>
  );
}

/* ── CrossRefsPanel ─────────────────────────────────────────── */
const XREF_CATS: { key: string; title: string; color: string; bg: string; border: string; icon: LucideIcon }[] = [
  { key: "d", title: "Direct References",    color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   icon: ArrowLeftRight },
  { key: "t", title: "Same Book",            color: "text-green-600",  bg: "bg-green-500/10",  border: "border-green-500/30",  icon: BookOpen },
  { key: "o", title: "Related",              color: "text-amber-600",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  icon: Link2 },
  { key: "n", title: "NT Connection",        color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: ArrowUpRight },
  { key: "f", title: "OT Foundation",        color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: Landmark },
  { key: "p", title: "Prophecy",             color: "text-rose-500",   bg: "bg-rose-500/10",   border: "border-rose-500/30",   icon: Eye },
  { key: "a", title: "Parallel",             color: "text-teal-500",   bg: "bg-teal-500/10",   border: "border-teal-500/30",   icon: AlignLeft },
  { key: "e", title: "Theme",                color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/30", icon: Tag },
];

interface XRefTrailEntry { book: string; ch: string; v: string; }

function CrossRefsPanel({
  book, chapter, verse, textMode, onClose, onNavigate, onSaveTrail,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  onClose: () => void;
  onNavigate: (book: string, ch: string, v: string) => void;
  onSaveTrail?: (trail: XRefTrailEntry[]) => Promise<void>;
}) {
  const [trail, setTrail] = useState<XRefTrailEntry[]>([{ book, ch: chapter, v: verse }]);
  const [cursor, setCursor] = useState(0);
  const [activeCatKey, setActiveCatKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTrail([{ book, ch: chapter, v: verse }]);
    setCursor(0); setActiveCatKey(null);
  }, [book, chapter, verse]);

  const current = trail[cursor];
  const xrefs = window.RhemaCrossRefs?.[`${current.book} ${current.ch}:${current.v}`] || null;
  const hasAny = !!xrefs && Object.values(xrefs).some(a => a?.length > 0);

  function followRef(ref: string) {
    const p = parseCrossRefKey(ref);
    if (!p) return;
    const newTrail = [...trail.slice(0, cursor + 1), { book: p.book, ch: p.ch, v: p.v }];
    setTrail(newTrail); setCursor(newTrail.length - 1); setActiveCatKey(null);
  }

  async function handleSave() {
    if (!onSaveTrail) return;
    setSaving(true);
    try { await onSaveTrail(trail); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    finally { setSaving(false); }
  }

  const activeCat = XREF_CATS.find(c => c.key === activeCatKey);
  const activeCatRefs = activeCatKey ? (xrefs?.[activeCatKey] || []) : [];
  const currentVerseName = `${BOOK_NAMES[current.book] || current.book} ${current.ch}:${current.v}`;
  const currentText = getEnglishText(current.book, current.ch, current.v, textMode);

  return (
    <div className="w-[520px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden animate-slideInRight">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3 mb-2">
          {(cursor > 0 || activeCatKey) && (
            <button onClick={activeCatKey ? () => setActiveCatKey(null) : () => { setCursor(c => c - 1); setActiveCatKey(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-text-primary">
              {activeCat ? activeCat.title : "Cross References"}
            </p>
            <p className="text-xs text-text-muted/60">{currentVerseName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-elevated text-text-muted transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Breadcrumb trail */}
        {trail.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {trail.map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[10px] text-text-muted/30">›</span>}
                <button onClick={() => { setCursor(i); setActiveCatKey(null); }}
                  className={cn("text-xs px-2 py-0.5 rounded-md transition-colors",
                    i === cursor ? "bg-accent/15 text-accent font-semibold" : "text-text-muted hover:text-text-primary hover:bg-bg-elevated")}>
                  {BOOK_NAMES[t.book] || t.book} {t.ch}:{t.v}
                </button>
              </span>
            ))}
            <button onClick={() => { setTrail([trail[0]]); setCursor(0); setActiveCatKey(null); }}
              className="ml-auto text-text-muted/40 hover:text-text-muted transition-colors p-1" title="Clear trail">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Current verse card */}
      <div className="px-5 py-4 border-b border-border-subtle bg-bg-elevated/30 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-accent mb-1.5">{currentVerseName}</p>
            {currentText && <p className="text-sm text-text-muted leading-relaxed">{currentText}</p>}
          </div>
          <button onClick={() => onNavigate(current.book, current.ch, current.v)}
            className="text-xs px-3 py-1.5 border border-border-subtle rounded-lg text-text-muted hover:border-accent hover:text-accent transition-colors shrink-0 mt-0.5 font-medium">
            Go →
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!activeCatKey ? (
          /* Category cards */
          <div className="py-2">
            {!hasAny && <p className="text-sm text-text-muted opacity-60 px-5 py-5">No cross references for this verse.</p>}
            {XREF_CATS.map(cat => {
              const refs = xrefs?.[cat.key] || [];
              if (!refs.length) return null;
              const firstParsed = parseCrossRefKey(refs[0]);
              const preview = firstParsed ? getEnglishText(firstParsed.book, firstParsed.ch, firstParsed.v, textMode) : "";
              const firstName = firstParsed ? `${BOOK_NAMES[firstParsed.book] || firstParsed.book} ${firstParsed.ch}:${firstParsed.v}` : "";
              return (
                <button key={cat.key} onClick={() => setActiveCatKey(cat.key)}
                  className="w-full text-left flex items-start gap-4 px-5 py-4 border-b border-border-subtle/40 hover:bg-bg-elevated transition-colors">
                  <cat.icon className={cn("h-5 w-5 shrink-0 mt-0.5", cat.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-text-primary">{cat.title}</p>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full shrink-0", cat.bg, cat.color)}>{refs.length}</span>
                    </div>
                    {firstName && <p className="text-xs text-text-muted/70 font-medium mb-0.5">{firstName}</p>}
                    {preview && <p className="text-xs text-text-muted/55 leading-relaxed line-clamp-2">{preview}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-muted/30 shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        ) : (
          /* Category detail */
          <div className="py-1">
            <div className={cn("flex items-center gap-3 px-5 py-3 mb-1 border-b border-border-subtle/40", activeCat?.bg)}>
              {activeCat && <activeCat.icon className={cn("h-5 w-5", activeCat.color)} />}
              <p className={cn("text-xs font-bold uppercase tracking-wider", activeCat?.color)}>{activeCat?.title}</p>
              <span className={cn("text-xs ml-auto font-bold", activeCat?.color)}>{activeCatRefs.length} references</span>
            </div>
            {activeCatRefs.map((ref, i) => {
              const parsed = parseCrossRefKey(ref);
              if (!parsed) return null;
              const text = getEnglishText(parsed.book, parsed.ch, parsed.v, textMode);
              const name = `${BOOK_NAMES[parsed.book] || parsed.book} ${parsed.ch}:${parsed.v}`;
              const hasSubs = !!(window.RhemaCrossRefs?.[`${parsed.book} ${parsed.ch}:${parsed.v}`]);
              return (
                <div key={i} className="border-b border-border-subtle/30 last:border-0 px-5 py-4 hover:bg-bg-elevated transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-sm font-semibold text-accent">{name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasSubs && (
                        <button onClick={() => followRef(ref)}
                          className="text-xs px-2.5 py-1 border border-border-subtle rounded-lg text-text-muted hover:border-accent/60 hover:text-accent transition-colors font-medium">
                          Explore ›
                        </button>
                      )}
                      <button onClick={() => onNavigate(parsed.book, parsed.ch, parsed.v)}
                        className="text-xs px-2.5 py-1 border border-border-subtle rounded-lg text-text-muted hover:border-accent hover:text-accent transition-colors font-medium">
                        Go →
                      </button>
                    </div>
                  </div>
                  {text && <p className="text-sm text-text-muted leading-relaxed">{text}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save trail footer */}
      {trail.length > 1 && onSaveTrail && (
        <div className="px-5 py-4 border-t border-border-subtle shrink-0">
          <button onClick={handleSave} disabled={saving}
            className={cn("w-full h-10 text-sm border rounded-xl transition-all flex items-center justify-center gap-2 font-medium",
              saved ? "border-green-500/50 text-green-600 bg-green-500/10"
                    : "border-border-subtle text-text-muted hover:border-accent hover:text-accent")}>
            {saving ? <><Save className="h-4 w-4 animate-pulse" /> Saving…</>
             : saved ? <><Check className="h-4 w-4" /> Trail saved to study</>
             : <><Save className="h-4 w-4" /> Save Trail to Study</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── WandPopup ──────────────────────────────────────────────── */
function WandPopup({
  syntaxMode, fullChapter, greekOnly, showEnglish, textMode, showHighlighter, intendedCount,
  isOTBook: isOT, hebrewMode, hebrewAvailable: hebAvail, englishMode, fontSize,
  onToggleSyntax, onToggleChapter, onToggleGreekOnly, onToggleEnglish, onToggleEnglishMode, onToggleTextMode, onToggleHighlight, onToggleHebrew, onSetFontSize,
}: {
  syntaxMode: boolean; fullChapter: boolean; greekOnly: boolean; showEnglish: boolean; textMode: TextMode;
  showHighlighter: boolean; intendedCount: number; englishMode: boolean; fontSize: FontSize;
  isOTBook: boolean; hebrewMode: boolean; hebrewAvailable: boolean;
  onToggleSyntax: () => void; onToggleChapter: () => void; onToggleGreekOnly: () => void;
  onToggleEnglish: () => void; onToggleEnglishMode: () => void; onToggleTextMode: () => void;
  onToggleHighlight: () => void; onToggleHebrew: () => void; onSetFontSize: (sz: FontSize) => void;
}) {
  const isHebrew = hebrewMode && isOT && hebAvail;
  return (
    <div className="absolute right-0 top-full mt-1 w-60 bg-bg-surface border border-border-subtle shadow-2xl z-[39] py-1.5 rounded-xl overflow-hidden">
      {/* Hebrew / LXX toggle for OT books */}
      {isOT && (
        <>
          {hebAvail ? (
            <WandItem
              active={hebrewMode}
              label={hebrewMode ? "Hebrew OT" : "LXX (Greek OT)"}
              desc={hebrewMode ? "Showing Hebrew Masoretic Text" : "Showing Septuagint Greek"}
              onClick={onToggleHebrew}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 opacity-50">
              <span className="h-3 w-3 rounded-full border border-accent border-t-transparent animate-spin shrink-0" />
              <span className="text-xs text-text-muted">Loading Hebrew data…</span>
            </div>
          )}
          <div className="my-1 border-t border-border-subtle/60" />
        </>
      )}
      {/* Syntax only available for Greek NT */}
      {!isHebrew && (
        <WandItem active={syntaxMode} label="Syntax Diagram" desc="See clause structure & grammar roles" onClick={onToggleSyntax} />
      )}
      <div className="my-1 border-t border-border-subtle/60" />
      <WandItem
        active={greekOnly}
        label={isHebrew ? "Hebrew Only" : "Greek Only"}
        desc="Hide word glosses beneath text"
        onClick={onToggleGreekOnly}
      />
      <WandItem active={fullChapter} label="Full Chapter" desc="Show all verses at once" onClick={onToggleChapter} />
      {!greekOnly && (
        <WandItem
          active={showEnglish}
          label={`English (${textMode === "critical" ? "BSB" : "MSB"})`}
          desc="Show translation below text"
          onClick={onToggleEnglish}
        />
      )}
      {/* Text mode toggle only for NT */}
      {!isOT && (
        <WandItem
          active={textMode === "critical"}
          label={textMode === "critical" ? "Critical Text" : "Majority Text"}
          desc={textMode === "critical" ? "Currently: SBL Critical NT" : "Currently: Byzantine Majority"}
          onClick={onToggleTextMode}
        />
      )}
      <div className="my-1 border-t border-border-subtle/60" />
      <WandItem
        active={showHighlighter}
        label="Word Highlighting"
        desc={intendedCount > 0 ? `${intendedCount} type${intendedCount > 1 ? "s" : ""} active` : "Highlight words by part of speech"}
        onClick={onToggleHighlight}
      />
      <WandItem
        active={englishMode}
        label="English Reader"
        desc="Show English-only reading view"
        onClick={onToggleEnglishMode}
      />
      <div className="my-1 border-t border-border-subtle/60" />
      <div className="px-3 py-2">
        <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest mb-2">Font Size</p>
        <div className="flex items-center gap-1.5">
          {([1,2,3,4,5] as FontSize[]).map(sz => (
            <button
              key={sz}
              onClick={() => onSetFontSize(sz)}
              className={cn("flex-1 py-1.5 rounded-lg text-center transition-colors",
                fontSize === sz ? "bg-accent/20 text-accent font-semibold" : "hover:bg-bg-elevated text-text-muted"
              )}
            >
              <span className={cn("font-serif block", sz === 1 ? "text-xs" : sz === 2 ? "text-sm" : sz === 3 ? "text-base" : sz === 4 ? "text-lg" : "text-xl")}>A</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WandItem({ active, label, desc, onClick }: {
  active: boolean; label: string; desc?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-bg-elevated transition-colors",
        active && "bg-accent/5"
      )}
    >
      <span className={cn(
        "h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5",
        active ? "border-accent bg-accent" : "border-[#3a4052]"
      )}>
        {active && <span className="h-1 w-1 rounded-full bg-bg-surface" />}
      </span>
      <div className="min-w-0">
        <p className={cn("text-xs font-medium leading-tight", active ? "text-accent" : "text-text-primary")}>{label}</p>
        {desc && <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{desc}</p>}
      </div>
    </button>
  );
}

/* ── HighlighterBar ─────────────────────────────────────────── */
const HL_SHORT: Record<string, string> = {
  V: "Verbs", N: "Nouns", ADJ: "Adj", T: "Art/Part",
  PRON: "Pron", PREP: "Prep", CONJ: "Conj", ADV: "Adv", PART: "Part",
  Np: "Proper", A: "Adj", P: "Pron", R: "Prep", C: "Conj", D: "Adv", S: "Suffix",
};

function HighlighterBar({ intendedHighlights, activeHighlights, versePosCats, shaking, isHebrew, onToggle, onClearAll, onClose }: {
  intendedHighlights: Set<string>;
  activeHighlights: Set<string>;
  versePosCats: Set<string>;
  shaking: string | null;
  isHebrew: boolean;
  onToggle: (cat: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const catConfig = isHebrew ? HEBREW_CATEGORY_CONFIG : CATEGORY_CONFIG;
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-bg-elevated/40 shrink-0 overflow-x-auto">
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest shrink-0 select-none">
        Highlight
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {Object.entries(catConfig).map(([cat, cfg]) => {
          const inVerse = versePosCats.has(cat);
          const isActive = activeHighlights.has(cat);
          const isIntended = intendedHighlights.has(cat);
          const isShaking = shaking === cat;
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              title={inVerse ? cfg.label : `${cfg.label} — none in this verse`}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border transition-colors shrink-0 select-none",
                isShaking && "animate-shake",
                isActive
                  ? cn(cfg.border, cfg.bg, cfg.text)
                  : isIntended
                  ? cn("border-border-subtle opacity-40", cfg.text)
                  : inVerse
                  ? "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
                  : "border-transparent text-text-muted opacity-20 cursor-default"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot, !isActive && "opacity-60")} />
              {HL_SHORT[cat] ?? cfg.label}
            </button>
          );
        })}
      </div>
      {intendedHighlights.size > 0 && (
        <button
          onClick={onClearAll}
          className="text-[10px] text-text-muted hover:text-danger transition-colors shrink-0 ml-1 whitespace-nowrap"
        >
          Clear
        </button>
      )}
      <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0 ml-auto">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── Hebrew lexicon search ─────────────────────────────────── */
function searchHebrewLexicon(query: string): Array<{ strongs: number; lex: HebrewLexEntry }> {
  if (!query.trim() || !window.RhemaHebrewLexicon) return [];
  const isHebrew = /[א-׿יִ-ﭏ]/.test(query);
  const q = query.toLowerCase();
  const prefix: Array<{ strongs: number; lex: HebrewLexEntry }> = [];
  const contains: Array<{ strongs: number; lex: HebrewLexEntry }> = [];
  const defMatch: Array<{ strongs: number; lex: HebrewLexEntry }> = [];
  for (const [key, lex] of Object.entries(window.RhemaHebrewLexicon)) {
    const entry = { strongs: Number(key), lex };
    if (isHebrew) {
      const lemma = lex.lemma || "";
      if (lemma.startsWith(query)) { prefix.push(entry); continue; }
      if (lemma.includes(query)) { contains.push(entry); continue; }
    } else {
      const trans = (lex.translit || "").toLowerCase();
      const brief = (lex.brief || "").replace(/<[^>]+>/g, "").toLowerCase();
      if (trans.startsWith(q)) { prefix.push(entry); continue; }
      if (trans.includes(q)) { contains.push(entry); continue; }
      if (q.length >= 3 && brief.includes(q)) defMatch.push(entry);
    }
  }
  return [...prefix, ...contains, ...defMatch].slice(0, 30);
}

/* ── WordLibraryPanel ───────────────────────────────────────── */
const GREEK_KEYS = ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","ο","π","ρ","σ","τ","υ","φ","χ","ψ","ω"];
const HEBREW_KEYS = ["א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק","ר","ש","ת"];

function WordLibraryPanel({ query, setQuery, loaded, isHebrew, onSelectLex, onSelectForm, onClose }: {
  query: string;
  setQuery: (q: string) => void;
  loaded: boolean;
  isHebrew: boolean;
  onSelectLex: (strongs: number, lex: LexEntry | HebrewLexEntry) => void;
  onSelectForm: (strongs: number, surface: string, morph: string) => void;
  onClose: () => void;
}) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lexResults    = useMemo(() => (!isHebrew && loaded ? searchLexicon(query) : []), [isHebrew, loaded, query]);
  const ntForms       = useMemo(() => (!isHebrew && loaded ? scanNTForms(query) : []), [isHebrew, loaded, query]);
  const hebLexResults = useMemo(() => (isHebrew && loaded ? searchHebrewLexicon(query) : []), [isHebrew, loaded, query]);

  const scriptFont = isHebrew
    ? "'Noto Serif Hebrew','SBL Hebrew','David','Times New Roman',serif"
    : "Georgia, 'Times New Roman', serif";
  const keys = isHebrew ? HEBREW_KEYS : GREEK_KEYS;
  const keyLabel = isHebrew ? "א" : "α";
  const keyTitle = isHebrew ? "Hebrew keyboard" : "Greek keyboard";

  function insertChar(ch: string) {
    setQuery(query + ch);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function doBackspace() {
    setQuery(query.slice(0, -1));
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="w-[340px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      <PanelHeader
        title={isHebrew ? "Hebrew Word Library" : "Word Library"}
        onClose={onClose}
      />
      <div className="px-3 py-2.5 border-b border-border-subtle flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isHebrew ? "Hebrew (שׁלם…), translit, or meaning…" : "Greek (ἀγαπ…), translit, or meaning…"}
            className="flex-1 h-8 bg-bg-elevated border border-border-subtle px-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent min-w-0 rounded-lg"
            style={{ direction: isHebrew ? "rtl" : "ltr" }}
            autoFocus
          />
          <button
            onClick={() => setShowKeyboard(v => !v)}
            title={keyTitle}
            className={cn("h-8 px-2.5 border text-base shrink-0 transition-colors rounded-lg",
              showKeyboard ? "border-accent text-accent bg-accent/10" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary")}
            style={{ fontFamily: scriptFont }}
          >{keyLabel}</button>
        </div>
        {showKeyboard && (
          <div className="flex flex-wrap gap-0.5">
            {keys.map(ch => (
              <button key={ch} onClick={() => insertChar(ch)}
                className="w-[26px] h-[26px] flex items-center justify-center border border-border-subtle text-text-primary text-sm hover:bg-bg-elevated hover:border-accent transition-colors rounded"
                style={{ fontFamily: scriptFont }}>
                {ch}
              </button>
            ))}
            <button onClick={doBackspace}
              className="px-2 h-[26px] flex items-center justify-center border border-border-subtle text-text-muted text-xs hover:bg-bg-elevated hover:border-[#3a4052] transition-colors ml-0.5 rounded">
              ⌫
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          <p className="text-xs text-text-muted opacity-60 p-4 leading-relaxed">
            {isHebrew
              ? "Search by Hebrew (use the א keyboard), transliteration, or English meaning."
              : "Search by Greek (use the α keyboard or type with accents), transliteration, or English meaning."
            }
          </p>
        ) : isHebrew ? (
          hebLexResults.length === 0
            ? <p className="text-xs text-text-muted opacity-60 p-4">No Hebrew results for &ldquo;{query}&rdquo;.</p>
            : (
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest px-4 py-1.5 border-b border-border-subtle/60 bg-bg-elevated/60 sticky top-0">Hebrew Lexicon</p>
                {hebLexResults.map(({ strongs, lex }) => {
                  const quick = (lex.brief || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().split(/[;,]/)[0].trim().slice(0, 60);
                  return (
                    <button key={strongs} onClick={() => onSelectLex(strongs, lex)}
                      className="w-full text-left px-4 py-2.5 hover:bg-bg-elevated border-b border-border-subtle/40 transition-colors">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-lg text-text-primary" style={{ fontFamily: scriptFont, direction: "rtl" }}>{lex.lemma || ""}</span>
                        {lex.translit && <span className="text-xs text-text-muted italic">{lex.translit}</span>}
                        <span className="ml-auto text-[10px] text-text-muted/70 shrink-0">H{strongs}</span>
                      </div>
                      {quick && <p className="text-[10px] text-text-muted truncate">{quick}</p>}
                    </button>
                  );
                })}
              </div>
            )
        ) : ntForms.length === 0 && lexResults.length === 0 ? (
          <p className="text-xs text-text-muted opacity-60 p-4">No results for &ldquo;{query}&rdquo;.</p>
        ) : (
          <>
            {ntForms.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest px-4 py-1.5 border-b border-border-subtle/60 bg-bg-elevated/60 sticky top-0">Exact Forms in NT</p>
                {ntForms.map((f, i) => {
                  const lex = getLex(f.strongs);
                  const formLabel = getMorphFormLabel(f.morph);
                  const brief = (lex.brief || "").replace(/<[^>]+>/g, "").split(",")[0].trim();
                  return (
                    <button key={i} onClick={() => onSelectForm(f.strongs, f.surface, f.morph)}
                      className="w-full text-left px-4 py-2.5 hover:bg-bg-elevated border-b border-border-subtle/40 transition-colors">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xl text-text-primary" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{f.surface}</span>
                        {lex.translit && <span className="text-xs text-text-muted italic">{lex.translit}</span>}
                        <span className="ml-auto text-[10px] text-text-muted/70 shrink-0">{f.count}×</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {formLabel && <span className="text-[10px] text-accent/80 font-semibold shrink-0">{formLabel}</span>}
                        {brief && <span className="text-[10px] text-text-muted truncate">{brief}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {lexResults.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest px-4 py-1.5 border-b border-border-subtle/60 bg-bg-elevated/60 sticky top-0">Lexical Forms</p>
                {lexResults.map(({ strongs, lex }) => {
                  const quick = (lex.quick_def || lex.brief || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().split(/[;,]/)[0].trim().slice(0, 55);
                  return (
                    <button key={strongs} onClick={() => onSelectLex(strongs, lex)}
                      className="w-full text-left px-4 py-2.5 hover:bg-bg-elevated border-b border-border-subtle/40 transition-colors">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xl text-text-primary" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{lex.lemma || ""}</span>
                        {lex.translit && <span className="text-xs text-text-muted italic">{lex.translit}</span>}
                        <span className="ml-auto text-[10px] text-text-muted/70 shrink-0">G{strongs}</span>
                      </div>
                      {quick && <p className="text-[10px] text-text-muted truncate">{quick}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── ObservationRich — renders AI text with clickable word refs ── */
function ObservationRich({ text, onWordClick }: { text: string; onWordClick?: (strongs: number) => void }) {
  const PATTERN = /(\S+)\s+\(([GH])(\d+)\)/g;
  const lines = text.split("\n").filter(l => l.trim());
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, li) => {
        const isBullet = line.trim().startsWith("•");
        const raw = isBullet ? line.trim().slice(1).trim() : line.trim();
        const segments: { t: "text" | "word"; text: string; strongs?: number }[] = [];
        let last = 0; PATTERN.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = PATTERN.exec(raw)) !== null) {
          if (m.index > last) segments.push({ t: "text", text: raw.slice(last, m.index) });
          segments.push({ t: "word", text: m[0], strongs: parseInt(m[3]) });
          last = m.index + m[0].length;
        }
        if (last < raw.length) segments.push({ t: "text", text: raw.slice(last) });
        return (
          <div key={li} className="text-xs text-text-primary leading-relaxed flex gap-1.5 items-start">
            {isBullet && <span className="text-accent shrink-0 select-none mt-0.5">•</span>}
            <span>
              {segments.map((seg, si) =>
                seg.t === "word" && seg.strongs !== undefined
                  ? <button key={si} onClick={() => onWordClick?.(seg.strongs!)}
                      className="text-accent font-semibold underline decoration-dotted underline-offset-2 hover:bg-accent/15 transition-colors rounded px-0.5"
                      style={{ fontFamily: "Georgia,'Times New Roman',serif" }}
                      title="Highlight in verse">
                      {seg.text}
                    </button>
                  : <span key={si}>{seg.text}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── StudyWorkspacePanel ────────────────────────────────────── */
type WorkspaceTab = "observations" | "interpretations" | "applications" | "questions";

const WS_META: Record<WorkspaceTab, { label: string; placeholder: string }> = {
  observations:    { label: "Observe",   placeholder: "What do you notice? Grammatical, structural, and literary observations…" },
  interpretations: { label: "Interpret", placeholder: "What does this mean? Theological significance and doctrinal insights…" },
  applications:    { label: "Apply",     placeholder: "How does this apply to life, ministry, or community?" },
  questions:       { label: "Questions", placeholder: "What are you wondering? What needs more study?" },
};

interface NoteHistoryEntry {
  id: string;
  name: string;
  observations: string;
  interpretations: string;
  applications: string;
  questions: string;
  aiObservations: string;
  savedAt: Date;
}

function StudyWorkspacePanel({
  book, chapter, verse, textMode, isHebrew,
  activeTab, onTabChange,
  observations, setObservations,
  interpretations, setInterpretations,
  applications, setApplications,
  questions, setQuestions,
  onClose, onHighlightWord,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode; isHebrew: boolean;
  activeTab: WorkspaceTab; onTabChange: (t: WorkspaceTab) => void;
  observations: string; setObservations: (v: string) => void;
  interpretations: string; setInterpretations: (v: string) => void;
  applications: string; setApplications: (v: string) => void;
  questions: string; setQuestions: (v: string) => void;
  onClose: () => void;
  onHighlightWord: (strongs: number) => void;
}) {
  const { user } = useAuthContext();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [aiObservations, setAiObservations] = useState("");
  const [noteName, setNoteName] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteHistory, setNoteHistory] = useState<NoteHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const passageKey = `${book}_${chapter}_${verse}`;

  /* Clear AI observations when verse changes */
  useEffect(() => { setAiObservations(""); }, [book, chapter, verse]);

  /* Load note history when verse changes */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const col = collection(db, "rhema_notes", user.uid, "passages", passageKey, "history");
        const q = query(col, orderBy("savedAt", "desc"));
        const snap = await getDocs(q);
        if (!cancelled) {
          setNoteHistory(snap.docs.map(d => ({
            id: d.id,
            name: d.data().name || "",
            observations: d.data().observations || "",
            interpretations: d.data().interpretations || "",
            applications: d.data().applications || "",
            questions: d.data().questions || "",
            aiObservations: d.data().aiObservations || "",
            savedAt: d.data().savedAt?.toDate?.() || new Date(),
          })));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user, passageKey]);

  async function saveNote() {
    if (!user) return;
    setNoteSaving(true);
    try {
      const col = collection(db, "rhema_notes", user.uid, "passages", passageKey, "history");
      await addDoc(col, {
        name: noteName.trim(),
        observations, interpretations, applications, questions,
        aiObservations,
        savedAt: new Date(),
      });
      setNoteSaved(true);
      setNoteName("");
      setTimeout(() => setNoteSaved(false), 2000);
      // Refresh history
      const q = query(col, orderBy("savedAt", "desc"));
      const snap = await getDocs(q);
      setNoteHistory(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || "",
        observations: d.data().observations || "",
        interpretations: d.data().interpretations || "",
        applications: d.data().applications || "",
        questions: d.data().questions || "",
        aiObservations: d.data().aiObservations || "",
        savedAt: d.data().savedAt?.toDate?.() || new Date(),
      })));
    } catch { /* ignore */ }
    setNoteSaving(false);
  }

  function loadHistoryEntry(entry: NoteHistoryEntry) {
    setObservations(entry.observations);
    setInterpretations(entry.interpretations);
    setApplications(entry.applications);
    setQuestions(entry.questions);
    setAiObservations(entry.aiObservations);
    setHistoryOpen(false);
  }

  function clearNote() {
    setObservations(""); setInterpretations(""); setApplications(""); setQuestions("");
    setAiObservations(""); setNoteName("");
    setHistoryOpen(false);
  }

  async function generateObservations() {
    setAiGenerating(true);
    try {
      const englishText = getEnglishText(book, chapter, verse, textMode);
      const ws = getWords(book, chapter, verse, textMode, isHebrew);
      const res = await fetch("/api/rhema/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: `${BOOK_NAMES[book] || book} ${chapter}:${verse}`,
          genre: BOOK_GENRE[book] || "narrative",
          englishText,
          textMode,
          isHebrew,
          originalWords: ws.map(w => ({ surface: w[0], strongs: w[1] })),
        }),
      });
      const data = await res.json();
      if (data.text) {
        setAiObservations(data.text);
        onTabChange("observations");
      }
    } catch { /* ignore */ }
    setAiGenerating(false);
  }

  const genre = BOOK_GENRE[book] || "narrative";
  const genreColor = GENRE_COLOR[genre] || "";
  const context = BOOK_CONTEXT[book];

  const value = activeTab === "observations" ? observations
    : activeTab === "interpretations" ? interpretations
    : activeTab === "applications" ? applications
    : questions;
  const setValue = activeTab === "observations" ? setObservations
    : activeTab === "interpretations" ? setInterpretations
    : activeTab === "applications" ? setApplications
    : setQuestions;
  const meta = WS_META[activeTab];

  return (
    <div className="w-[360px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text-primary">Study Workspace</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{BOOK_NAMES[book] || book} {chapter}:{verse}</p>
        </div>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0", genreColor)}>
          {genre}
        </span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0"><X className="h-4 w-4" /></button>
      </div>

      {/* Book context (collapsible) */}
      {context && (
        <div className="px-4 py-2 border-b border-border-subtle/50 bg-bg-elevated/30 shrink-0">
          <button onClick={() => setContextOpen(v => !v)}
            className="flex items-center gap-1.5 w-full text-left group">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors">Historical Context</span>
            <ChevronDown className={cn("h-3 w-3 text-text-muted ml-auto transition-transform", contextOpen && "rotate-180")} />
          </button>
          {contextOpen && (
            <p className="text-xs text-text-muted leading-relaxed mt-2">{context}</p>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-border-subtle shrink-0">
        {(Object.entries(WS_META) as [WorkspaceTab, typeof WS_META[WorkspaceTab]][]).map(([tab, m]) => (
          <button key={tab} onClick={() => onTabChange(tab)}
            className={cn("flex-1 py-2 text-[9px] font-semibold uppercase tracking-wide transition-colors border-b-2",
              activeTab === tab
                ? "text-text-primary border-accent"
                : "text-text-muted border-transparent hover:text-text-primary")}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Toolbar: AI generate (Observe tab only) */}
      {activeTab === "observations" && (
        <div className="px-4 pt-3 pb-0 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-text-muted font-semibold uppercase tracking-widest">Observations</span>
          <button
            onClick={generateObservations}
            disabled={aiGenerating}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 border border-accent/40 text-accent hover:bg-accent/10 transition-colors rounded-full disabled:opacity-50"
          >
            {aiGenerating
              ? <><div className="h-2.5 w-2.5 border border-current border-t-transparent rounded-full animate-spin" /> Generating…</>
              : <><Wand2 className="h-2.5 w-2.5" /> Generate</>}
          </button>
        </div>
      )}

      {/* Textarea + AI observations */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-2 flex flex-col gap-2 min-h-0">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={meta.placeholder}
          className="w-full shrink-0 bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent leading-relaxed"
          rows={6}
        />

        {/* AI observations — shown below textarea when generated */}
        {activeTab === "observations" && aiObservations && (
          <div className="shrink-0 bg-bg-elevated/50 border border-border-subtle rounded-lg px-3 py-2.5">
            <p className="text-[9px] text-accent font-semibold uppercase tracking-widest mb-2">AI Observations</p>
            <ObservationRich text={aiObservations} onWordClick={onHighlightWord} />
          </div>
        )}

      </div>

      {/* Notes History */}
      <div className="border-t border-border-subtle/50 shrink-0">
        <button
          onClick={() => setHistoryOpen(v => !v)}
          className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-bg-elevated/40 transition-colors"
        >
          <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <span className="text-xs text-text-muted flex-1 text-left">
            {noteHistory.length > 0 ? `${noteHistory.length} saved note${noteHistory.length > 1 ? "s" : ""}` : "No saved notes"}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-text-muted transition-transform shrink-0", historyOpen && "rotate-180")} />
        </button>
        {historyOpen && (
          <div className="border-t border-border-subtle/30 max-h-36 overflow-y-auto">
            <button
              onClick={clearNote}
              className="w-full px-4 py-2 flex items-center gap-2 hover:bg-bg-elevated/40 transition-colors border-b border-border-subtle/20"
            >
              <Plus className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-xs text-accent font-medium">New blank note</span>
            </button>
            {noteHistory.map(entry => (
              <button
                key={entry.id}
                onClick={() => loadHistoryEntry(entry)}
                className="w-full px-4 py-2.5 flex items-start gap-2 hover:bg-bg-elevated/40 transition-colors border-b border-border-subtle/10 last:border-0 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-primary font-medium truncate">{entry.name || "Untitled note"}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {entry.savedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {entry.savedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Name + Save */}
      <div className="px-4 pb-4 pt-3 flex flex-col gap-2 shrink-0">
        <input
          value={noteName}
          onChange={e => setNoteName(e.target.value)}
          placeholder="Name this note (optional)…"
          className="w-full h-9 bg-bg-elevated border border-border-subtle rounded-xl px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button onClick={saveNote} disabled={noteSaving}
          className={cn("w-full h-10 flex items-center justify-center gap-2 text-sm font-medium border transition-colors disabled:opacity-60 rounded-xl",
            noteSaved ? "border-accent text-accent bg-accent/10" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary")}>
          {noteSaved ? <><Check className="h-4 w-4" /> Saved</>
            : noteSaving ? <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
            : <><Save className="h-4 w-4" /> Save Note</>}
        </button>
      </div>
    </div>
  );
}

/* ── PanelHeader (shared) ───────────────────────────────────── */
function PanelHeader({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 border-b border-border-subtle flex items-center gap-2 shrink-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-text-primary">{title}</p>
        {subtitle && <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>}
      </div>
      {children}
      <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0"><X className="h-4 w-4" /></button>
    </div>
  );
}

/* ── PickerOverlay ──────────────────────────────────────────── */
function PickerOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg-surface border border-border-subtle shadow-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto p-5 mx-4 rounded-2xl animate-scaleIn">
        {children}
      </div>
    </div>
  );
}

/* ── ToolBtn (icon + label toolbar button) ──────────────────── */
function ToolBtn({ active, onClick, label, dot, children }: {
  active: boolean; onClick: () => void; label: string; dot?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={label}
      className={cn("h-9 px-3.5 flex items-center gap-2 border transition-colors relative rounded-xl",
        active ? "border-accent text-accent bg-accent/10" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary")}>
      {children}
      <span className="text-sm hidden sm:inline">{label}</span>
      {dot && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />}
    </button>
  );
}
