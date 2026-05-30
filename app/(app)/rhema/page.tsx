"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, BookOpen, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OT_BOOK_ORDER, NT_BOOK_ORDER, BOOK_ORDER, BOOK_NAMES,
  decodeMorph, type MorphRow,
} from "./utils";

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

const DATA_FILES = [
  "rhema-nt.js", "rhema-critical.js", "rhema-lxx.js",
  "rhema-lexicon.js", "rhema-mm.js", "rhema-msb.js",
  "rhema-bsb.js", "rhema-syntax.js", "rhema-crossrefs.js",
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

/* ── Main component ─────────────────────────────────────────── */
export default function RhemaPage() {
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
  const [, forceUpdate] = useState(0);
  const loadingRef = useRef(false);

  /* Load data scripts */
  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    let loaded = 0;
    let failed = false;
    for (const file of DATA_FILES) {
      const s = document.createElement("script");
      s.src = `/rhema/${file}`;
      s.onload = () => {
        loaded++;
        if (loaded === DATA_FILES.length) {
          setLoaded(true);
          forceUpdate(n => n + 1);
        }
      };
      s.onerror = () => {
        if (!failed) { failed = true; setLoadError(true); }
      };
      document.head.appendChild(s);
    }
  }, []);

  /* Keyboard navigation */
  useEffect(() => {
    if (!loaded) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") navigateVerse(1);
      if (e.key === "ArrowLeft")  navigateVerse(-1);
      if (e.key === "Escape") {
        setActiveWord(null);
        setBookPickerOpen(false);
        setChPickerOpen(false);
        setVPickerOpen(false);
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
  }

  function selectChapter(ch: string) {
    const firstV = getVerses(book, ch, textMode)[0] || "1";
    setChapter(ch); setVerse(firstV);
    setActiveWord(null); setChPickerOpen(false);
  }

  function selectVerse(v: string) {
    setVerse(v); setActiveWord(null); setVPickerOpen(false);
  }

  const words = loaded ? getWords(book, chapter, verse, textMode) : [];
  const englishText = loaded ? getEnglishText(book, chapter, verse, textMode) : "";
  const allBooks = loaded ? getBookOrder(textMode) : [];
  const chapters = loaded ? getChapters(book, textMode) : [];
  const verses = loaded ? getVerses(book, chapter, textMode) : [];
  const bookName = BOOK_NAMES[book] || book;

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
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
            <span className="font-serif text-base text-accent leading-none">Ρ</span>
          </div>
          <span className="text-sm font-semibold text-text-primary hidden sm:block">Rhema</span>
        </div>

        {/* Book picker */}
        <button
          onClick={() => { setBookPickerOpen(true); setChPickerOpen(false); setVPickerOpen(false); }}
          className="flex items-center gap-1 px-3 h-8 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary font-medium transition-colors"
        >
          {bookName}
          <ChevronDown className="h-3 w-3 text-text-muted" />
        </button>

        {/* Chapter picker */}
        <button
          onClick={() => { setChPickerOpen(true); setBookPickerOpen(false); setVPickerOpen(false); }}
          className="flex items-center gap-1 px-3 h-8 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary transition-colors"
        >
          Ch {chapter}
          <ChevronDown className="h-3 w-3 text-text-muted" />
        </button>

        {/* Verse picker */}
        {!fullChapter && (
          <button
            onClick={() => { setVPickerOpen(true); setBookPickerOpen(false); setChPickerOpen(false); }}
            className="flex items-center gap-1 px-3 h-8 bg-bg-elevated border border-border-subtle hover:border-[#3a4052] text-sm text-text-primary transition-colors"
          >
            v {verse}
            <ChevronDown className="h-3 w-3 text-text-muted" />
          </button>
        )}

        {/* Nav arrows */}
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

        {/* Toggles */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <ToggleBtn active={fullChapter} onClick={() => setFullChapter(v => !v)} label="Chapter" />
          <ToggleBtn active={greekOnly} onClick={() => setGreekOnly(v => !v)} label="Greek Only" />
          {!greekOnly && <ToggleBtn active={showEnglish} onClick={() => setShowEnglish(v => !v)} label="English" />}
          <ToggleBtn
            active={textMode === "critical"}
            onClick={() => setTextMode(m => m === "critical" ? "majority" : "critical")}
            label={textMode === "critical" ? "Critical" : "Majority"}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Center: Greek text */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {fullChapter ? (
            <ChapterView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} greekOnly={greekOnly} showEnglish={showEnglish}
              activeWord={activeWord}
              onWordClick={(w) => { setActiveWord(w); setActiveTab("parsing"); }}
              englishLabel={getEnglishLabel(textMode)}
            />
          ) : (
            <VerseView
              book={book} chapter={chapter} verse={verse}
              textMode={textMode} greekOnly={greekOnly} showEnglish={showEnglish}
              activeWord={activeWord}
              onWordClick={(w) => { setActiveWord(w); setActiveTab("parsing"); }}
              englishText={englishText}
              englishLabel={getEnglishLabel(textMode)}
            />
          )}
        </div>

        {/* Right: Word detail */}
        {activeWord && (
          <WordDetail
            word={activeWord}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            textMode={textMode}
            onClose={() => setActiveWord(null)}
            onNavigateOccurrence={(b, ch, v) => {
              setBook(b); setChapter(ch); setVerse(v);
              setFullChapter(false); setActiveWord(null);
            }}
          />
        )}
      </div>

      {/* ── Book picker overlay ── */}
      {bookPickerOpen && (
        <PickerOverlay onClose={() => { setBookPickerOpen(false); setBookSearch(""); }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Select Book</h3>
            <button onClick={() => { setBookPickerOpen(false); setBookSearch(""); }} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            value={bookSearch}
            onChange={e => setBookSearch(e.target.value)}
            placeholder="Search books…"
            className="w-full h-8 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-4"
            autoFocus
          />
          {otBooks.length > 0 && (
            <>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Old Testament</p>
              <div className="grid grid-cols-3 gap-1 mb-4">
                {otBooks.map(c => (
                  <button key={c} onClick={() => selectBook(c)}
                    className={cn("px-2 py-1.5 text-xs text-left transition-colors border",
                      c === book ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]"
                    )}>
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
                      c === book ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]"
                    )}>
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
            <button onClick={() => setChPickerOpen(false)} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {chapters.map(c => (
              <button key={c} onClick={() => selectChapter(c)}
                className={cn("h-9 text-sm font-medium border transition-colors",
                  c === chapter ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]"
                )}>
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
            <button onClick={() => setVPickerOpen(false)} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {verses.map(v => (
              <button key={v} onClick={() => selectVerse(v)}
                className={cn("h-9 text-sm font-medium border transition-colors",
                  v === verse ? "border-accent text-accent bg-accent/5" : "border-border-subtle text-text-muted hover:text-text-primary hover:border-[#3a4052]"
                )}>
                {v}
              </button>
            ))}
          </div>
        </PickerOverlay>
      )}
    </div>
  );
}

/* ── VerseView ──────────────────────────────────────────────── */
function VerseView({
  book, chapter, verse, textMode, greekOnly, showEnglish,
  activeWord, onWordClick, englishText, englishLabel,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  greekOnly: boolean; showEnglish: boolean; activeWord: Word | null;
  onWordClick: (w: Word) => void; englishText: string; englishLabel: string;
}) {
  const words = getWords(book, chapter, verse, textMode);
  const ref = `${BOOK_NAMES[book] || book} ${chapter}:${verse}`;
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-6">{ref}</p>
      <div className={cn("flex flex-wrap gap-x-3 gap-y-4 mb-6", greekOnly && "gap-y-2")}>
        {words.map((w, i) => (
          <WordChip
            key={i} word={w} greekOnly={greekOnly}
            active={activeWord?.[0] === w[0] && activeWord?.[1] === w[1]}
            onClick={() => onWordClick(w)}
          />
        ))}
      </div>
      {!greekOnly && showEnglish && (
        <div className="border-t border-border-subtle pt-5 mt-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
            {englishLabel}
          </p>
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
  activeWord, onWordClick, englishLabel,
}: {
  book: string; chapter: string; verse: string; textMode: TextMode;
  greekOnly: boolean; showEnglish: boolean; activeWord: Word | null;
  onWordClick: (w: Word) => void; englishLabel: string;
}) {
  const verses = getVerses(book, chapter, textMode);
  const bookName = BOOK_NAMES[book] || book;
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-6">
        {bookName} {chapter}
      </p>
      {verses.map(v => {
        const words = getWords(book, chapter, v, textMode);
        const engText = getEnglishText(book, chapter, v, textMode);
        const isTarget = v === targetVerse;
        return (
          <div key={v} className={cn("mb-8 pb-6 border-b border-border-subtle/50", isTarget && "bg-accent/3 -mx-2 px-2 rounded")}>
            <span className="text-xs font-bold text-accent mr-2 select-none">{v}</span>
            <div className={cn("inline-flex flex-wrap gap-x-3 gap-y-3 mt-2", greekOnly && "gap-y-1")}>
              {words.map((w, i) => (
                <WordChip
                  key={i} word={w} greekOnly={greekOnly}
                  active={activeWord?.[0] === w[0] && activeWord?.[1] === w[1]}
                  onClick={() => onWordClick(w)}
                />
              ))}
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
function WordChip({
  word, greekOnly, active, onClick,
}: {
  word: Word; greekOnly: boolean; active: boolean; onClick: () => void;
}) {
  const [surface, strongs] = word;
  const lex = getLex(strongs);
  const gloss = lex.brief ? lex.brief.split(",")[0].split(";")[0].trim() : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 px-1.5 py-1 border transition-colors duration-100 group",
        active
          ? "border-accent bg-accent/10"
          : "border-transparent hover:border-border-subtle hover:bg-bg-elevated"
      )}
    >
      <span
        className={cn(
          "text-xl leading-tight select-none",
          active ? "text-accent" : "text-text-primary group-hover:text-accent"
        )}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {surface}
      </span>
      {!greekOnly && gloss && (
        <span className="text-[10px] text-text-muted leading-none max-w-[80px] truncate">
          {gloss}
        </span>
      )}
    </button>
  );
}

/* ── WordDetail panel ───────────────────────────────────────── */
function WordDetail({
  word, activeTab, setActiveTab, textMode, onClose, onNavigateOccurrence,
}: {
  word: Word; activeTab: ActiveTab; setActiveTab: (t: ActiveTab) => void;
  textMode: TextMode; onClose: () => void;
  onNavigateOccurrence: (book: string, ch: string, v: string) => void;
}) {
  const [surface, strongs, morph] = word;
  const lex = getLex(strongs);
  const quick = getQuickDef(lex);

  return (
    <div className="w-[300px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border-subtle flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl text-text-primary leading-none mb-1"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {surface}
          </p>
          {lex.lemma && (
            <p className="text-sm text-accent font-medium"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {lex.lemma}
            </p>
          )}
          {lex.translit && (
            <p className="text-xs text-text-muted italic">{lex.translit}</p>
          )}
          {quick && (
            <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">{quick}</p>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {(["parsing","definition","occurrences"] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 text-xs font-medium capitalize transition-colors border-b-2",
              activeTab === tab
                ? "text-text-primary border-accent"
                : "text-text-muted border-transparent hover:text-text-primary"
            )}
          >
            {tab === "occurrences" ? "Occ." : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "parsing" && <ParsingTab surface={surface} strongs={strongs} morph={morph} />}
        {activeTab === "definition" && <DefinitionTab strongs={strongs} />}
        {activeTab === "occurrences" && (
          <OccurrencesTab strongs={strongs} textMode={textMode} onNavigate={onNavigateOccurrence} />
        )}
      </div>
    </div>
  );
}

/* ── ParsingTab ─────────────────────────────────────────────── */
function ParsingTab({ surface, strongs, morph }: { surface: string; strongs: number; morph: string }) {
  const rows: MorphRow[] = decodeMorph(morph);
  const lex = getLex(strongs);

  if (!rows.length) {
    return <p className="text-sm text-text-muted opacity-60">No parsing data for "{morph}".</p>;
  }

  return (
    <div className="flex flex-col gap-0">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start justify-between py-2 border-b border-border-subtle/50 last:border-0">
          <span className="text-xs text-text-muted w-28 shrink-0">{row.label}</span>
          <div className="text-right">
            <span className="text-sm text-text-primary font-medium">{row.value}</span>
            {row.desc && <p className="text-xs text-text-muted mt-0.5">{row.desc}</p>}
          </div>
        </div>
      ))}
      {lex.lemma && (
        <div className="mt-4 pt-4 border-t border-border-subtle">
          <p className="text-xs text-text-muted mb-1">Morph Code</p>
          <p className="text-xs font-mono text-text-muted opacity-60">{morph}</p>
        </div>
      )}
    </div>
  );
}

/* ── DefinitionTab ──────────────────────────────────────────── */
function DefinitionTab({ strongs }: { strongs: number }) {
  const lex = getLex(strongs);
  if (!lex.lemma && !lex.brief) {
    return <p className="text-sm text-text-muted opacity-60">No definition found.</p>;
  }

  const sections: { label: string; content: string }[] = [];

  if (lex.abbott_smith) sections.push({ label: "Abbott-Smith", content: lex.abbott_smith });
  if (lex.moulton_milligan) sections.push({ label: "Moulton-Milligan", content: lex.moulton_milligan });
  if (lex.extended || lex.brief) sections.push({ label: "Dodson", content: (lex.extended || lex.brief)! });
  if (lex.strongs_def) sections.push({
    label: "Strong's",
    content: lex.strongs_def + (lex.kjv_def ? `<div style="opacity:.6;margin-top:4px;font-size:.8rem">Glosses: ${lex.kjv_def}</div>` : ""),
  });
  if (lex.deriv) sections.push({ label: "Etymology", content: lex.deriv });

  return (
    <div className="flex flex-col gap-4">
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">{s.label}</p>
          <div
            className="text-sm text-text-primary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: s.content }}
          />
          {i < sections.length - 1 && <div className="mt-4 border-b border-border-subtle/50" />}
        </div>
      ))}
    </div>
  );
}

/* ── OccurrencesTab ─────────────────────────────────────────── */
function OccurrencesTab({
  strongs, textMode, onNavigate,
}: {
  strongs: number; textMode: TextMode;
  onNavigate: (book: string, ch: string, v: string) => void;
}) {
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const occ = getOccurrences(strongs, textMode);

  if (!occ.total) {
    return <p className="text-sm text-text-muted opacity-60">No occurrences found.</p>;
  }

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
              <BookOccurrences
                book={bk} strongs={strongs} textMode={textMode}
                onNavigate={(ch, v) => onNavigate(bk, ch, v)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookOccurrences({
  book, strongs, textMode, onNavigate,
}: {
  book: string; strongs: number; textMode: TextMode;
  onNavigate: (ch: string, v: string) => void;
}) {
  const text = getText(textMode);
  const bookText = text[book] || {};
  const refs: { ch: string; v: string; words: Word[] }[] = [];

  for (const ch of Object.keys(bookText).sort((a, b) => Number(a) - Number(b))) {
    for (const v of Object.keys(bookText[ch]).sort((a, b) => Number(a) - Number(b))) {
      const words: Word[] = bookText[ch][v];
      if (words.some((w: Word) => w[1] === strongs)) {
        refs.push({ ch, v, words });
      }
    }
  }

  return (
    <div className="ml-2 border-l border-border-subtle pl-2 mb-2">
      {refs.map(({ ch, v, words }) => {
        const preview = words.map((w: Word) =>
          w[1] === strongs
            ? `<span style="color:#c9a84c;font-weight:600">${w[0]}</span>`
            : w[0]
        ).join(" ");
        return (
          <button
            key={`${ch}:${v}`}
            onClick={() => onNavigate(ch, v)}
            className="w-full text-left px-2 py-1.5 hover:bg-bg-elevated transition-colors border-b border-border-subtle/30 last:border-0"
          >
            <p className="text-xs text-accent font-semibold mb-0.5">{ch}:{v}</p>
            <p
              className="text-xs text-text-muted leading-relaxed"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ── PickerOverlay ──────────────────────────────────────────── */
function PickerOverlay({
  children, onClose,
}: {
  children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-surface border border-border-subtle shadow-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto p-5 mx-4">
        {children}
      </div>
    </div>
  );
}

/* ── ToggleBtn ──────────────────────────────────────────────── */
function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-3 text-xs font-medium border transition-colors",
        active
          ? "border-accent text-accent bg-accent/10"
          : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}
