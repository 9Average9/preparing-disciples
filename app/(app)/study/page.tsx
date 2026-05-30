"use client";

import { useState } from "react";
import { Search, Save, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
  "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
  "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John",
  "3 John", "Jude", "Revelation",
];

const PLACEHOLDER_PASSAGE = {
  ref: "Romans 8:28–30",
  text: [
    {
      verse: 28,
      text: "And we know that for those who love God all things work together for good, for those who are called according to his purpose.",
    },
    {
      verse: 29,
      text: "For those whom he foreknew he also predestined to be conformed to the image of his Son, in order that he might be the firstborn among many brothers.",
    },
    {
      verse: 30,
      text: "And those whom he predestined he also called, and those whom he called he also justified, and those whom he justified he also glorified.",
    },
  ],
};

export default function StudyWorkspacePage() {
  const [book, setBook] = useState("Romans");
  const [chapter, setChapter] = useState("8");
  const [verseFrom, setVerseFrom] = useState("28");
  const [verseTo, setVerseTo] = useState("30");
  const [searchQuery, setSearchQuery] = useState("");
  const [passage, setPassage] = useState<typeof PLACEHOLDER_PASSAGE | null>(
    null
  );
  const [notes, setNotes] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [searching, setSearching] = useState(false);

  function handleSearch() {
    if (!book || !chapter) return;
    setSearching(true);
    // Simulate loading
    setTimeout(() => {
      setPassage(PLACEHOLDER_PASSAGE);
      setSearching(false);
    }, 600);
  }

  function handleSaveNotes() {
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border-subtle bg-bg-surface shrink-0">
        <h1 className="text-xl font-bold text-text-primary">
          Study Workspace
        </h1>
        <p className="text-sm text-text-muted mt-0.5">
          Search passages, read scripture, and take study notes
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: Passage search */}
        <aside className="w-[260px] shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border-subtle">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
              Passage Search
            </p>

            {/* Book selector */}
            <div className="flex flex-col gap-2 mb-3">
              <label className="text-xs text-text-muted">Book</label>
              <select
                value={book}
                onChange={(e) => setBook(e.target.value)}
                className="h-8 bg-bg-elevated border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {BIBLE_BOOKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-text-muted">Chapter</label>
                <input
                  type="number"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  min={1}
                  className="h-8 bg-bg-elevated border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-text-muted">Verse from</label>
                <input
                  type="number"
                  value={verseFrom}
                  onChange={(e) => setVerseFrom(e.target.value)}
                  min={1}
                  className="h-8 bg-bg-elevated border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-text-muted">To</label>
                <input
                  type="number"
                  value={verseTo}
                  onChange={(e) => setVerseTo(e.target.value)}
                  min={1}
                  className="h-8 bg-bg-elevated border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={handleSearch}
              loading={searching}
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
          </div>

          {/* Text search */}
          <div className="p-4 border-b border-border-subtle">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
              Text Search
            </p>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keywords…"
                className="flex-1 h-8 bg-bg-elevated border border-border-subtle px-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button className="h-8 w-8 bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:border-[#3a4052] transition-colors">
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Recent passages */}
          <div className="p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
              Recent
            </p>
            <div className="flex flex-col gap-1">
              {RECENT_PASSAGES.map((ref) => (
                <button
                  key={ref}
                  className="flex items-center justify-between text-left px-2 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  <span>{ref}</span>
                  <ChevronRight className="h-3 w-3 opacity-40" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER: Passage display */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          {passage ? (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <BookOpen className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-bold text-text-primary">
                  {passage.ref}
                </h2>
                <span className="text-xs text-text-muted border border-border-subtle px-2 py-0.5">
                  ESV
                </span>
              </div>
              <div className="flex flex-col gap-4 max-w-2xl">
                {passage.text.map((v) => (
                  <div key={v.verse} className="flex gap-4">
                    <span className="text-sm font-semibold text-accent shrink-0 w-6 pt-0.5">
                      {v.verse}
                    </span>
                    <p className="text-base text-text-primary leading-relaxed">
                      {v.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Study tools placeholder */}
              <div className="mt-8 pt-8 border-t border-border-subtle">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                  Word Study
                </p>
                <div className="flex flex-wrap gap-2">
                  {["foreknew", "predestined", "conformed", "justified", "glorified"].map(
                    (word) => (
                      <button
                        key={word}
                        className="px-3 py-1 text-xs border border-border-subtle text-text-muted hover:border-accent hover:text-accent transition-colors"
                      >
                        {word}
                      </button>
                    )
                  )}
                </div>
                <p className="text-xs text-text-muted mt-3">
                  Click a word to open its Greek/Hebrew entry in Rhema
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <BookOpen className="h-12 w-12 text-border-subtle mb-4" />
              <h3 className="text-base font-semibold text-text-primary mb-2">
                Search for a passage to begin studying
              </h3>
              <p className="text-sm text-text-muted max-w-xs">
                Select a book, chapter, and verse range on the left, then click
                Search.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Study notes */}
        <aside className="w-[280px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col">
          <div className="px-4 py-4 border-b border-border-subtle flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              Study Notes
            </p>
            {passage && (
              <span className="text-xs text-text-muted">{passage.ref}</span>
            )}
          </div>
          <div className="flex-1 p-4 flex flex-col gap-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                passage
                  ? `Notes on ${passage.ref}…\n\nObservations, cross-references, theological insights…`
                  : "Open a passage to start taking notes."
              }
              disabled={!passage}
              className="flex-1 w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent disabled:opacity-50 leading-relaxed min-h-[300px]"
            />
          </div>
          <div className="p-4 border-t border-border-subtle">
            <Button
              variant={noteSaved ? "ghost" : "secondary"}
              size="sm"
              className="w-full"
              onClick={handleSaveNotes}
              disabled={!passage || !notes.trim()}
            >
              {noteSaved ? (
                <>
                  <span className="text-success">Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Notes
                </>
              )}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

const RECENT_PASSAGES = [
  "John 6:35–51",
  "Psalm 23:1–6",
  "Romans 8:28–39",
  "Isaiah 40:28–31",
  "Matthew 5:1–12",
];
