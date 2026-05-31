"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, ChevronDown, Copy, FileText, Link2, Save, Check, BookOpen, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OT_BOOK_ORDER, NT_BOOK_ORDER, BOOK_ORDER, BOOK_NAMES,
  decodeMorph, normalizePosKey, type MorphRow,
} from "./utils";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
    RhemaSyntax?: Record<string, Record<string, Record<string, Array<{ role?: string; head?: number }>>>> ;
  }
}

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

type Word = [string, number, string]; // [surface, strongs, morph]
type TextMode = "majority" | "critical";
type ActiveTab = "parsing" | "definition" | "occurrences";

const STORAGE_BASE =
  "https://firebasestorage.googleapis.com/v0/b/disciple-preparer.firebasestorage.app/o/rhema%2F";

const DATA_FILES = [
  "rhema-nt.js", "rhema-critical.js", "rhema-lxx.js",
  "rhema-lexicon.js", "rhema-mm.js", "rhema-msb.js",
  "rhema-bsb.js", "rhema-syntax.js", "rhema-crossrefs.js",
];

const CROSS_REF_LABELS: Record<string, string> = {
  d: "Immediate Context", t: "Same Book", o: "Related",
  n: "NT Connection", f: "OT Foundation", p: "Prophecy",
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

function getWords(book: string, ch: string, v: string, mode: TextMode): Word[] {
  return getText(mode)[book]?.[ch]?.[v] || [];
}

function getEnglishText(book: string, ch: string, v: string, mode: TextMode): string {
  const src = mode === "critical" ? window.RhemaBSB : window.RhemaMSB;
  return src?.[book]?.[String(ch)]?.[String(v)] || "";
}

function getEnglishLabel(mode: TextMode) {
  return mode === "critical" ? "BSB" : "MSB";
}

function getBookOrder(mode: TextMode): string[] {
  const text = getText(mode);
  return BOOK_ORDER.filter(c => text[c]);
}

function getChapters(book: string, mode: TextMode): string[] {
  const chObj = getText(mode)[book] || {};
  return Object.keys(chObj).sort((a, b) => Number(a) - Number(b));
}

function getVerses(book: string, ch: string, mode: TextMode): string[] {
  const vObj = getText(mode)[book]?.[ch] || {};
  return Object.keys(vObj).sort((a, b) => Number(a) - Number(b));
}

function getLex(strongs: number): LexEntry {
  return (window.RhemaLexicon || {})[strongs] || {};
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

/* Case-inflected gloss for nouns/pronouns/adjectives: "of God", "to/for God" */
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
  if (posRaw === "P") {
    caseCode = cng[0] === "1" || cng[0] === "2" ? cng[1] : cng[0];
  } else if (posRaw === "F") {
    caseCode = cng[1];
  } else if (posRaw === "S") {
    caseCode = cng[2];
  } else {
    caseCode = cng[0];
  }
  const CASE_PREP: Record<string, string> = { N: "", G: "of ", D: "to/for ", A: "", V: "O " };
  const prep = CASE_PREP[caseCode];
  if (prep === undefined) return base;
  return prep ? `${prep}${base}` : base;
}

/* Unified word gloss: routes to verb or noun function based on morph code */
function getWordGloss(lex: LexEntry, morph: string): string {
  const brief = (lex.brief || lex.quick_def || "").replace(/<[^>]+>/g, "").trim();
  if (!brief) return "";
  if (morph.startsWith("V-")) return verbGloss(morph, brief);
  return nounGloss(morph, brief);
}

function getOccurrences(strongs: number, mode: TextMode): { total: number; books: Record<string, number> } {
  const text = getText(mode);
  const result: Record<string, number> = {};
  let total = 0;
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

function searchLexicon(query: string): Array<{ strongs: number; lex: LexEntry }> {
  if (!query.trim() || !window.RhemaLexicon) return [];
  const q = query.toLowerCase();
  const results: Array<{ strongs: number; lex: LexEntry }> = [];
  for (const [key, lex] of Object.entries(window.RhemaLexicon)) {
    if (results.length >= 25) break;
    const lemma  = (lex.lemma  || "").toLowerCase();
    const trans  = (lex.translit || "").toLowerCase();
    const brief  = (lex.brief  || "").replace(/<[^>]+>/g, "").toLowerCase();
    const qd     = (lex.quick_def || "").replace(/<[^>]+>/g, "").toLowerCase();
    if (lemma.includes(q) || trans.includes(q) || brief.includes(q) || qd.includes(q)) {
      results.push({ strongs: Number(key), lex });
    }
  }
  return results;
}

/* ── Main component ─────────────────────────────────────────── */
export default function RhemaPage() {
  const { user } = useAuthContext();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [book, setBook] = useState("JOH");
  const [chapter, setChapter] = useState("3");
  const [verse, setVerse] = useState("16");
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
  const [, forceUpdate] = useState(0);
  const loadingRef = useRef(false);

  // Navigation history (persisted in localStorage)
  const [navHistory, setNavHistory] = useState<Array<{ book: string; chapter: string; verse: string }>>([]);

  // Right panel state
  const [showCrossRefs, setShowCrossRefs] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showHighlighter, setShowHighlighter] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Study notes
  const [observations, setObservations] = useState("");
  const [interpretations, setInterpretations] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

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
    let count = 0;
    let failed = false;
    for (const file of DATA_FILES) {
      const s = document.createElement("script");
      s.src = `${STORAGE_BASE}${encodeURIComponent(file)}?alt=media`;
      s.onload = () => {
        count++;
        if (count === DATA_FILES.length) { setLoaded(true); forceUpdate(n => n + 1); }
      };
      s.onerror = () => { if (!failed) { failed = true; setLoadError(true); } };
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
        } else {
          setObservations("");
          setInterpretations("");
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, book, chapter, verse, textMode]);

  const navigateVerse = useCallback((dir: 1 | -1) => {
    const verses = getVerses(book, chapter, textMode);
    const idx = verses.indexOf(verse);
    if (dir === 1) {
      if (idx < verses.length - 1) { setVerse(verses[idx + 1]); setActiveWord(null); }
      else {
        const chs = getChapters(book, textMode);
        const ci = chs.indexOf(chapter);
        if (ci < chs.length - 1) {
          const nc = chs[ci + 1];
          const nv = getVerses(book, nc, textMode)[0];
          setChapter(nc); setVerse(nv); setActiveWord(null);
        }
      }
    } else {
      if (idx > 0) { setVerse(verses[idx - 1]); setActiveWord(null); }
      else {
        const chs = getChapters(book, textMode);
        const ci = chs.indexOf(chapter);
        if (ci > 0) {
          const nc = chs[ci - 1];
          const nvs = getVerses(book, nc, textMode);
          setChapter(nc); setVerse(nvs[nvs.length - 1]); setActiveWord(null);
        }
      }
    }
  }, [book, chapter, verse, textMode]);

  function selectBook(code: string) {
    const chs = getChapters(code, textMode);
    const firstCh = chs[0] || "1";
    const firstV = getVerses(code, firstCh, textMode)[0] || "1";
    setBook(code); setChapter(firstCh); setVerse(firstV);
    setActiveWord(null); setBookPickerOpen(false); setBookSearch("");
    setNavHistory([]);
  }

  function selectChapter(ch: string) {
    const firstV = getVerses(book, ch, textMode)[0] || "1";
    setChapter(ch); setVerse(firstV);
    setActiveWord(null); setChPickerOpen(false);
  }

  function selectVerse(v: string) {
    setVerse(v); setActiveWord(null); setVPickerOpen(false);
  }

  function handleNavigateOccurrence(b: string, ch: string, v: string) {
    setNavHistory(h => [...h, { book, chapter, verse }]);
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
    setNavHistory(h => h.slice(0, idx));
    setBook(stop.book); setChapter(stop.chapter); setVerse(stop.verse);
    setActiveWord(null);
  }

  function copyVerse() {
    const ws = getWords(book, chapter, verse, textMode);
    const greek = ws.map(w => w[0]).join(" ");
    const english = getEnglishText(book, chapter, verse, textMode);
    const text = `${BOOK_NAMES[book] || book} ${chapter}:${verse}\n${greek}${english ? "\n" + english : ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function saveNotes() {
    if (!user) return;
    setNoteSaving(true);
    try {
      const ref = doc(db, "rhema_notes", user.uid, "passages", `${book}_${chapter}_${verse}`);
      await setDoc(ref, { observations, interpretations, updatedAt: new Date() });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch { /* ignore */ }
    setNoteSaving(false);
  }

  function closeAllPanels() {
    setActiveWord(null);
    setShowCrossRefs(false);
    setShowNotes(false);
    setShowHighlighter(false);
    setShowLibrary(false);
    setShowWandPopup(false);
  }

  /* ── Computed values ── */
  const allBooks   = loaded ? getBookOrder(textMode) : [];
  const chapters   = loaded ? getChapters(book, textMode) : [];
  const verses     = loaded ? getVerses(book, chapter, textMode) : [];
  const bookName   = BOOK_NAMES[book] || book;
  const englishText = loaded ? getEnglishText(book, chapter, verse, textMode) : "";
  const variantSet  = loaded ? getVariantSet(book, chapter, verse, textMode) : new Set<number>();
  const crossRefs   = loaded ? (window.RhemaCrossRefs?.[`${book} ${chapter}:${verse}`] || null) : null;
  const hasCrossRefs = !!crossRefs && Object.values(crossRefs).some(a => a?.length > 0);
  const hasActiveMode = fullChapter || greekOnly || textMode === "critical" || (!greekOnly && !showEnglish) || intendedHighlights.size > 0;

  /* POS categories present in the current verse */
  const versePosCats = useMemo(() => {
    if (!loaded) return new Set<string>();
    const cats = new Set<string>();
    for (const w of getWords(book, chapter, verse, textMode)) {
      const cat = normalizePosKey(w[2]);
      if (cat) cats.add(cat);
    }
    return cats;
  }, [loaded, book, chapter, verse, textMode]);

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

  const libraryResults = useMemo(
    () => (loaded ? searchLexicon(libraryQuery) : []),
    [libraryQuery, loaded]
  );

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
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-bg-surface shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
            <span className="font-serif text-base text-accent leading-none">Ρ</span>
          </div>
          <span className="text-sm font-semibold text-text-primary hidden sm:block">Rhema</span>
        </div>

        <button
          onClick={() => { setBookPickerOpen(true); setChPickerOpen(false); setVPickerOpen(false); }}
          className="flex items-center gap-1 px-3 h-8 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary font-medium transition-colors"
        >
          {bookName}
          <ChevronDown className="h-3 w-3 text-text-muted" />
        </button>

        <button
          onClick={() => { setChPickerOpen(true); setBookPickerOpen(false); setVPickerOpen(false); }}
          className="flex items-center gap-1 px-3 h-8 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary transition-colors"
        >
          Ch {chapter}
          <ChevronDown className="h-3 w-3 text-text-muted" />
        </button>

        {!fullChapter && (
          <button
            onClick={() => { setVPickerOpen(true); setBookPickerOpen(false); setChPickerOpen(false); }}
            className="flex items-center gap-1 px-3 h-8 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary transition-colors"
          >
            v {verse}
            <ChevronDown className="h-3 w-3 text-text-muted" />
          </button>
        )}

        {!fullChapter && (
          <div className="flex items-center gap-1">
            <button onClick={() => navigateVerse(-1)} className="h-8 w-8 flex items-center justify-center bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigateVerse(1)} className="h-8 w-8 flex items-center justify-center bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Copy verse */}
          <button onClick={copyVerse} title="Copy verse"
            className={cn("h-7 w-7 flex items-center justify-center border transition-colors",
              copied ? "border-accent text-accent bg-accent/10" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
            )}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {/* Cross references */}
          <ToolBtn
            active={showCrossRefs}
            onClick={() => { setShowCrossRefs(v => !v); setShowNotes(false); setShowHighlighter(false); setShowLibrary(false); setActiveWord(null); }}
            label="Refs"
            dot={hasCrossRefs && !showCrossRefs}
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolBtn>

          {/* Word library */}
          <ToolBtn
            active={showLibrary}
            onClick={() => { setShowLibrary(v => !v); setShowCrossRefs(false); setShowNotes(false); setActiveWord(null); setShowWandPopup(false); }}
            label="Library"
          >
            <BookOpen className="h-3.5 w-3.5" />
          </ToolBtn>

          {/* Study notes */}
          <ToolBtn
            active={showNotes}
            onClick={() => { setShowNotes(v => !v); setShowCrossRefs(false); setShowLibrary(false); setActiveWord(null); setShowWandPopup(false); }}
            label="Notes"
          >
            <FileText className="h-3.5 w-3.5" />
          </ToolBtn>

          <div className="w-px h-4 bg-border-subtle mx-0.5" />

          {/* Modes wand */}
          <div className="relative z-[39]">
            <button
              onClick={() => setShowWandPopup(v => !v)}
              title="View modes & highlighting"
              className={cn("h-7 px-2 flex items-center gap-1.5 border transition-colors relative",
                showWandPopup || hasActiveMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
              )}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="text-[10px] hidden sm:inline">Modes</span>
              {hasActiveMode && !showWandPopup && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
            {showWandPopup && (
              <WandPopup
                fullChapter={fullChapter} greekOnly={greekOnly} showEnglish={showEnglish}
                textMode={textMode} showHighlighter={showHighlighter}
                intendedCount={intendedHighlights.size}
                onToggleChapter={() => setFullChapter(v => !v)}
                onToggleGreekOnly={() => setGreekOnly(v => !v)}
                onToggleEnglish={() => setShowEnglish(v => !v)}
                onToggleTextMode={() => setTextMode(m => m === "critical" ? "majority" : "critical")}
                onToggleHighlight={() => { setShowHighlighter(v => !v); setShowWandPopup(false); }}
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
                className="text-xs text-accent hover:text-accent-hover whitespace-nowrap px-1.5 py-1 hover:bg-bg-elevated transition-colors rounded-sm"
              >
                {BOOK_NAMES[stop.book] || stop.book} {stop.chapter}:{stop.verse}
              </button>
              <ChevronRight className="h-3 w-3 text-text-muted opacity-30 shrink-0" />
            </span>
          ))}
          <span className="text-xs text-text-primary font-medium whitespace-nowrap px-1.5 py-1 shrink-0">
            {bookName} {chapter}:{verse}
          </span>
          <button onClick={() => setNavHistory([])}
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
          onToggle={toggleHighlightCategory}
          onClearAll={() => setIntendedHighlights(new Set())}
          onClose={() => setShowHighlighter(false)}
        />
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {fullChapter ? (
            <ChapterView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} greekOnly={greekOnly} showEnglish={showEnglish}
              activeWord={activeWord} activeHighlights={activeHighlights}
              onWordClick={(w) => { setActiveWord(w); setActiveTab("parsing"); closeAllPanels(); setActiveWord(w); }}
              englishLabel={getEnglishLabel(textMode)}
            />
          ) : (
            <VerseView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} greekOnly={greekOnly} showEnglish={showEnglish}
              activeWord={activeWord} activeHighlights={activeHighlights} variantSet={variantSet}
              onWordClick={(w) => { setActiveWord(w); setActiveTab("parsing"); closeAllPanels(); setActiveWord(w); }}
              englishText={englishText}
              englishLabel={getEnglishLabel(textMode)}
            />
          )}
        </div>

        {/* Right panels */}
        {activeWord && !showCrossRefs && !showNotes && !showLibrary && (
          <WordDetail
            word={activeWord} activeTab={activeTab} setActiveTab={setActiveTab}
            textMode={textMode} book={book} chapter={chapter} verse={verse}
            onClose={() => setActiveWord(null)}
            onNavigateOccurrence={handleNavigateOccurrence}
            onGrammarExample={(cat, val) => setGrammarModal({ category: cat, value: val })}
          />
        )}
        {showCrossRefs && (
          <CrossRefsPanel
            book={book} chapter={chapter} verse={verse}
            crossRefs={crossRefs}
            onClose={() => setShowCrossRefs(false)}
            onNavigate={(b, ch, v) => { handleNavigateOccurrence(b, ch, v); setShowCrossRefs(false); }}
          />
        )}
        {showLibrary && (
          <WordLibraryPanel
            query={libraryQuery}
            setQuery={setLibraryQuery}
            results={libraryResults}
            onSelect={(strongs, lex) => {
              setActiveWord([lex.lemma || "", strongs, ""]);
              setActiveTab("definition");
              setShowLibrary(false);
            }}
            onClose={() => setShowLibrary(false)}
          />
        )}
        {showNotes && (
          <StudyNotesPanel
            book={book} chapter={chapter} verse={verse}
            observations={observations} setObservations={setObservations}
            interpretations={interpretations} setInterpretations={setInterpretations}
            noteSaving={noteSaving} noteSaved={noteSaved}
            onSave={saveNotes}
            onClose={() => setShowNotes(false)}
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
            className="w-full h-8 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-4"
            autoFocus />
          {otBooks.length > 0 && (
            <>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Old Testament</p>
              <div className="grid grid-cols-3 gap-1 mb-4">
                {otBooks.map(c => (
                  <button key={c} onClick={() => selectBook(c)}
                    className={cn("px-2 py-1.5 text-xs text-left transition-colors border",
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
                    className={cn("px-2 py-1.5 text-xs text-left transition-colors border",
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
                className={cn("h-9 text-sm font-medium border transition-colors",
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
                className={cn("h-9 text-sm font-medium border transition-colors",
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
      <div className="bg-bg-surface border border-border-subtle shadow-2xl w-full max-w-md">
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
  activeWord, activeHighlights, variantSet, onWordClick, englishText, englishLabel,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  greekOnly: boolean; showEnglish: boolean; activeWord: Word | null;
  activeHighlights: Set<string>; variantSet: Set<number>;
  onWordClick: (w: Word) => void;
  englishText: string; englishLabel: string;
}) {
  const words = getWords(book, chapter, verse, textMode);
  const ref = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-6">{ref}</p>
      <div className={cn("flex flex-wrap gap-x-3 gap-y-4 mb-6", greekOnly && "gap-y-2")}>
        {words.map((w, i) => {
          const cat = normalizePosKey(w[2]);
          const hlConfig = cat && activeHighlights.has(cat) ? CATEGORY_CONFIG[cat] : null;
          return (
            <WordChip key={i} word={w} greekOnly={greekOnly}
              active={activeWord?.[0] === w[0] && activeWord?.[1] === w[1]}
              isVariant={variantSet.has(i)}
              highlightConfig={hlConfig ?? null}
              onClick={() => onWordClick(w)}
            />
          );
        })}
      </div>
      {!greekOnly && showEnglish && (
        <div className="border-t border-border-subtle pt-5 mt-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">{englishLabel}</p>
          <p className="text-base text-text-muted leading-relaxed">
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
  activeWord, activeHighlights, onWordClick, englishLabel,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  greekOnly: boolean; showEnglish: boolean; activeWord: Word | null;
  activeHighlights: Set<string>;
  onWordClick: (w: Word) => void;
  englishLabel: string;
}) {
  const verses = getVerses(book, chapter, textMode);
  const bookName = BOOK_NAMES[book] || book;
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-6">{bookName} {chapter}</p>
      {verses.map(v => {
        const words = getWords(book, chapter, v, textMode);
        const engText = getEnglishText(book, chapter, v, textMode);
        const isTarget = v === targetVerse;
        const variantSet = getVariantSet(book, chapter, v, textMode);
        return (
          <div key={v} className={cn("mb-8 pb-6 border-b border-border-subtle/50", isTarget && "bg-accent/3 -mx-2 px-2 rounded")}>
            <span className="text-xs font-bold text-accent mr-2 select-none">{v}</span>
            <div className={cn("inline-flex flex-wrap gap-x-3 gap-y-3 mt-2", greekOnly && "gap-y-1")}>
              {words.map((w, i) => {
                const cat = normalizePosKey(w[2]);
                const hlConfig = cat && activeHighlights.has(cat) ? CATEGORY_CONFIG[cat] : null;
                return (
                  <WordChip key={i} word={w} greekOnly={greekOnly}
                    active={activeWord?.[0] === w[0] && activeWord?.[1] === w[1]}
                    isVariant={variantSet.has(i)}
                    highlightConfig={hlConfig ?? null}
                    onClick={() => onWordClick(w)}
                  />
                );
              })}
            </div>
            {!greekOnly && showEnglish && (
              <p className="text-sm text-text-muted leading-relaxed mt-3 pl-4 border-l border-border-subtle">
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

/* ── WordChip ───────────────────────────────────────────────── */
type CategoryStyle = typeof CATEGORY_CONFIG[string];

function WordChip({
  word, greekOnly, active, isVariant, highlightConfig, onClick,
}: {
  word: Word; greekOnly: boolean; active: boolean;
  isVariant: boolean;
  highlightConfig: CategoryStyle | null;
  onClick: () => void;
}) {
  const [surface, strongs, morph] = word;
  const lex = getLex(strongs);
  const gloss = getWordGloss(lex, morph);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-0.5 px-1.5 py-1 border transition-colors duration-100 group",
        active
          ? "border-accent bg-accent/10"
          : highlightConfig
          ? cn(highlightConfig.border, highlightConfig.bg)
          : "border-transparent hover:border-border-subtle hover:bg-bg-elevated"
      )}
    >
      {isVariant && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-400/90 ring-1 ring-bg-base" title="Text variant" />
      )}
      <span
        className={cn(
          "text-xl leading-tight select-none",
          active ? "text-accent"
            : highlightConfig ? highlightConfig.text
            : "text-text-primary group-hover:text-accent"
        )}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {surface}
      </span>
      {!greekOnly && gloss && (
        <span className={cn("text-[10px] leading-none max-w-[80px] truncate",
          highlightConfig ? highlightConfig.text + " opacity-80" : "text-text-muted")}>
          {gloss}
        </span>
      )}
    </button>
  );
}

/* ── WordDetail panel ───────────────────────────────────────── */
function WordDetail({
  word, activeTab, setActiveTab, textMode, book, chapter, verse, onClose, onNavigateOccurrence, onGrammarExample,
}: {
  word: Word; activeTab: ActiveTab; setActiveTab: (t: ActiveTab) => void;
  textMode: TextMode; book: string; chapter: string; verse: string;
  onClose: () => void;
  onNavigateOccurrence: (book: string, ch: string, v: string) => void;
  onGrammarExample: (category: string, value: string) => void;
}) {
  const [surface, strongs, morph] = word;
  const lex = getLex(strongs);
  const words = getWords(book, chapter, verse, textMode);
  const wordIdx = words.findIndex(w => w[0] === surface && w[1] === strongs && w[2] === morph);
  const strongs_label = strongs ? `G${strongs}` : "LXX";
  const inflected = getWordGloss(lex, morph);

  return (
    <div className="w-[320px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl text-text-primary leading-none" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{surface}</span>
            <span className="text-xs text-text-muted font-mono opacity-60">{strongs_label}</span>
          </div>
          {lex.lemma && (
            <p className="text-sm text-accent" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {lex.lemma}{lex.translit ? <span className="text-xs text-text-muted italic font-sans ml-2">{lex.translit}</span> : null}
            </p>
          )}
          {inflected && (
            <p className="text-xs text-text-muted mt-1.5 px-2 py-1 bg-bg-elevated border-l-2 border-accent/40 italic">
              &ldquo;{inflected}&rdquo;
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0 mt-0.5"><X className="h-4 w-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {(["parsing","definition","occurrences"] as ActiveTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-2 text-xs font-medium transition-colors border-b-2",
              activeTab === tab ? "text-text-primary border-accent" : "text-text-muted border-transparent hover:text-text-primary")}>
            {tab === "occurrences" ? "Occurrences" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "parsing" && (
          <ParsingTab surface={surface} strongs={strongs} morph={morph}
            book={book} chapter={chapter} verse={verse} wordIdx={wordIdx}
            onGrammarExample={onGrammarExample} />
        )}
        {activeTab === "definition" && <DefinitionTab strongs={strongs} morph={morph} />}
        {activeTab === "occurrences" && (
          <OccurrencesTab strongs={strongs} textMode={textMode} onNavigate={onNavigateOccurrence} />
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
  const syntaxRole = window.RhemaSyntax?.[book]?.[chapter]?.[verse]?.[wordIdx]?.role;

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

  const sections: { label: string; content: string }[] = [];
  if (lex.abbott_smith) sections.push({ label: "Abbott-Smith", content: lex.abbott_smith });
  if (lex.moulton_milligan) sections.push({ label: "Moulton-Milligan", content: lex.moulton_milligan });
  if (lex.extended || lex.brief) sections.push({ label: "Dodson", content: (lex.extended || lex.brief)! });
  if (lex.strongs_def) sections.push({
    label: "Strong's",
    content: lex.strongs_def + (lex.kjv_def ? `<div style="opacity:.65;margin-top:6px;font-size:.78rem;font-style:italic">KJV glosses: ${lex.kjv_def}</div>` : ""),
  });
  if (lex.deriv) sections.push({ label: "Etymology", content: lex.deriv });

  return (
    <div className="flex flex-col gap-4">
      {quickDisplay && (
        <div className="p-2.5 bg-accent/5 border-l-2 border-accent/50">
          <p className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-1">
            {inflected ? "Inflected Gloss" : "Quick Definition"}
          </p>
          <p className="text-sm text-text-primary leading-relaxed italic">&ldquo;{quickDisplay}&rdquo;</p>
          {inflected && quickClean && quickClean !== inflected && (
            <p className="text-xs text-text-muted mt-1 not-italic">{quickClean}</p>
          )}
        </div>
      )}
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">{s.label}</p>
          <div className="text-sm text-text-primary leading-relaxed" dangerouslySetInnerHTML={{ __html: s.content }} />
          {i < sections.length - 1 && <div className="mt-4 border-b border-border-subtle/50" />}
        </div>
      ))}
    </div>
  );
}

/* ── OccurrencesTab ─────────────────────────────────────────── */
function OccurrencesTab({ strongs, textMode, onNavigate }: {
  strongs: number; textMode: TextMode;
  onNavigate: (book: string, ch: string, v: string) => void;
}) {
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const occ = getOccurrences(strongs, textMode);
  if (!occ.total) return <p className="text-sm text-text-muted opacity-60">No occurrences found.</p>;
  const bookList = getBookOrder(textMode).filter(b => occ.books[b]);
  return (
    <div>
      <p className="text-xs text-text-muted mb-3">
        Appears <span className="text-accent font-semibold">{occ.total}</span>× in Rhema
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
              <BookOccurrences book={bk} strongs={strongs} textMode={textMode}
                onNavigate={(ch, v) => onNavigate(bk, ch, v)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookOccurrences({ book, strongs, textMode, onNavigate }: {
  book: string; strongs: number; textMode: TextMode;
  onNavigate: (ch: string, v: string) => void;
}) {
  const text = getText(textMode);
  const bookText = text[book] || {};
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
        ).join(" ");
        return (
          <button key={`${ch}:${v}`} onClick={() => onNavigate(ch, v)}
            className="w-full text-left px-2 py-1.5 hover:bg-bg-elevated transition-colors border-b border-border-subtle/30 last:border-0">
            <p className="text-xs text-accent font-semibold mb-0.5">{ch}:{v}</p>
            <p className="text-xs text-text-muted leading-relaxed" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              dangerouslySetInnerHTML={{ __html: preview }} />
          </button>
        );
      })}
    </div>
  );
}

/* ── CrossRefsPanel ─────────────────────────────────────────── */
function CrossRefsPanel({ book, chapter, verse, crossRefs, onClose, onNavigate }: {
  book: string; chapter: string; verse: string;
  crossRefs: Record<string, string[]> | null;
  onClose: () => void;
  onNavigate: (book: string, ch: string, v: string) => void;
}) {
  const labels = window.RhemaCrossRefLabels || [];
  return (
    <div className="w-[300px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      <PanelHeader title="Cross References" subtitle={`${BOOK_NAMES[book] || book} ${chapter}:${verse}`} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        {!crossRefs || !Object.values(crossRefs).some(a => a?.length > 0) ? (
          <p className="text-sm text-text-muted opacity-60">No cross references for this verse.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(crossRefs).map(([key, refs], ci) => {
              if (!refs?.length) return null;
              const label = labels[ci] || CROSS_REF_LABELS[key] || key.toUpperCase();
              return (
                <div key={key}>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">{label}</p>
                  <div className="flex flex-col gap-0.5">
                    {refs.map((r, i) => {
                      const parsed = parseCrossRefKey(r);
                      if (!parsed) return null;
                      return (
                        <button key={i} onClick={() => onNavigate(parsed.book, parsed.ch, parsed.v)}
                          className="w-full text-left px-2 py-1.5 text-xs text-text-muted hover:text-accent hover:bg-bg-elevated transition-colors">
                          {BOOK_NAMES[parsed.book] || parsed.book} {parsed.ch}:{parsed.v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── WandPopup ──────────────────────────────────────────────── */
function WandPopup({
  fullChapter, greekOnly, showEnglish, textMode, showHighlighter, intendedCount,
  onToggleChapter, onToggleGreekOnly, onToggleEnglish, onToggleTextMode, onToggleHighlight,
}: {
  fullChapter: boolean; greekOnly: boolean; showEnglish: boolean; textMode: TextMode;
  showHighlighter: boolean; intendedCount: number;
  onToggleChapter: () => void; onToggleGreekOnly: () => void;
  onToggleEnglish: () => void; onToggleTextMode: () => void; onToggleHighlight: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-1 w-56 bg-bg-surface border border-border-subtle shadow-2xl z-[39] py-1.5">
      <WandItem active={greekOnly} label="Greek Only" desc="Hide word glosses beneath text" onClick={onToggleGreekOnly} />
      <WandItem active={fullChapter} label="Full Chapter" desc="Show all verses at once" onClick={onToggleChapter} />
      {!greekOnly && (
        <WandItem
          active={showEnglish}
          label={`English (${textMode === "critical" ? "BSB" : "MSB"})`}
          desc="Show translation below Greek"
          onClick={onToggleEnglish}
        />
      )}
      <WandItem
        active={textMode === "critical"}
        label={textMode === "critical" ? "Critical Text" : "Majority Text"}
        desc={textMode === "critical" ? "Currently: SBL Critical NT" : "Currently: Byzantine Majority"}
        onClick={onToggleTextMode}
      />
      <div className="my-1 border-t border-border-subtle/60" />
      <WandItem
        active={showHighlighter}
        label="Word Highlighting"
        desc={intendedCount > 0 ? `${intendedCount} type${intendedCount > 1 ? "s" : ""} active` : "Highlight words by part of speech"}
        onClick={onToggleHighlight}
      />
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
  V: "Verbs", N: "Nouns", ADJ: "Adj", T: "Art",
  PRON: "Pron", PREP: "Prep", CONJ: "Conj", ADV: "Adv", PART: "Part",
};

function HighlighterBar({ intendedHighlights, activeHighlights, versePosCats, shaking, onToggle, onClearAll, onClose }: {
  intendedHighlights: Set<string>;
  activeHighlights: Set<string>;
  versePosCats: Set<string>;
  shaking: string | null;
  onToggle: (cat: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-bg-elevated/40 shrink-0 overflow-x-auto">
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest shrink-0 select-none">
        Highlight
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
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

/* ── WordLibraryPanel ───────────────────────────────────────── */
function WordLibraryPanel({ query, setQuery, results, onSelect, onClose }: {
  query: string;
  setQuery: (q: string) => void;
  results: Array<{ strongs: number; lex: LexEntry }>;
  onSelect: (strongs: number, lex: LexEntry) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-[300px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      <PanelHeader title="Word Library" onClose={onClose} />
      <div className="px-4 py-3 border-b border-border-subtle">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search lemma, transliteration, or meaning…"
          className="w-full h-8 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          <p className="text-xs text-text-muted opacity-60 p-4">Type to search the Greek lexicon.</p>
        ) : results.length === 0 ? (
          <p className="text-xs text-text-muted opacity-60 p-4">No results found.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle/50">
            {results.map(({ strongs, lex }) => {
              const quick = (lex.quick_def || lex.brief || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
              return (
                <button
                  key={strongs}
                  onClick={() => onSelect(strongs, lex)}
                  className="w-full text-left px-4 py-3 hover:bg-bg-elevated transition-colors"
                >
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-base text-text-primary" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      {lex.lemma || ""}
                    </span>
                    {lex.translit && <span className="text-xs text-text-muted italic">{lex.translit}</span>}
                    <span className="ml-auto text-[10px] text-text-muted opacity-60">G{strongs}</span>
                  </div>
                  {quick && <p className="text-xs text-text-muted leading-relaxed truncate">{quick}</p>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── StudyNotesPanel ────────────────────────────────────────── */
function StudyNotesPanel({
  book, chapter, verse,
  observations, setObservations,
  interpretations, setInterpretations,
  noteSaving, noteSaved, onSave, onClose,
}: {
  book: string; chapter: string; verse: string;
  observations: string; setObservations: (v: string) => void;
  interpretations: string; setInterpretations: (v: string) => void;
  noteSaving: boolean; noteSaved: boolean;
  onSave: () => void; onClose: () => void;
}) {
  return (
    <div className="w-[300px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      <PanelHeader title="Study Notes" subtitle={`${BOOK_NAMES[book] || book} ${chapter}:${verse}`} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Observations</p>
          <textarea value={observations} onChange={e => setObservations(e.target.value)}
            placeholder="What does the text say? Grammatical, structural, literary observations…"
            className="w-full min-h-[120px] bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent leading-relaxed" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Interpretations</p>
          <textarea value={interpretations} onChange={e => setInterpretations(e.target.value)}
            placeholder="What does the text mean? Theological significance, cross-reference connections…"
            className="w-full min-h-[120px] bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent leading-relaxed" />
        </div>
      </div>
      <div className="p-4 border-t border-border-subtle">
        <button onClick={onSave} disabled={noteSaving}
          className={cn("w-full h-8 flex items-center justify-center gap-2 text-xs font-medium border transition-colors disabled:opacity-60",
            noteSaved ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary")}>
          {noteSaved ? <><Check className="h-3.5 w-3.5" /> Saved</>
            : noteSaving ? <><div className="h-3.5 w-3.5 border border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
            : <><Save className="h-3.5 w-3.5" /> Save Notes</>}
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
      <div className="bg-bg-surface border border-border-subtle shadow-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto p-5 mx-4">
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
      className={cn("h-7 px-2 flex items-center gap-1.5 border transition-colors relative",
        active ? "border-accent text-accent bg-accent/10" : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary")}>
      {children}
      <span className="text-[10px] hidden sm:inline">{label}</span>
      {dot && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />}
    </button>
  );
}
