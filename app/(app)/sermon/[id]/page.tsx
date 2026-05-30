"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Layers,
  Check,
  BookOpen,
  ExternalLink,
  X,
  GripVertical,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { useAuthContext } from "@/components/AuthProvider";
import { getSermon, updateSermon } from "@/lib/sermons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Sermon, MainPoint, VerseRef, SermonOutline } from "@/types";

type SaveStatus = "saved" | "saving" | "unsaved";
type ActiveSection =
  | { type: "intro" }
  | { type: "point"; index: number }
  | { type: "conclusion" };

function newMainPoint(index: number): MainPoint {
  return {
    id: crypto.randomUUID(),
    title: `Point ${index + 1}`,
    subPoints: [],
    verses: [],
    notes: "",
    illustration: "",
  };
}

export default function SermonWorkshopPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();

  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [activeSection, setActiveSection] = useState<ActiveSection>({
    type: "intro",
  });
  const [expandedPoints, setExpandedPoints] = useState<Set<number>>(new Set());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    getSermon(id)
      .then((s) => {
        if (s) setSermon(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const scheduleAutoSave = useCallback(
    (updated: Sermon) => {
      setSaveStatus("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updateSermon(updated.id, {
            title: updated.title,
            status: updated.status,
            outline: updated.outline,
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("unsaved");
        }
      }, 1200);
    },
    []
  );

  function updateOutline(patch: Partial<SermonOutline>) {
    if (!sermon) return;
    const updated: Sermon = {
      ...sermon,
      outline: { ...sermon.outline, ...patch },
    };
    setSermon(updated);
    scheduleAutoSave(updated);
  }

  function updatePoint(index: number, patch: Partial<MainPoint>) {
    if (!sermon) return;
    const points = [...sermon.outline.mainPoints];
    points[index] = { ...points[index], ...patch };
    updateOutline({ mainPoints: points });
  }

  function addPoint() {
    if (!sermon) return;
    const points = sermon.outline.mainPoints;
    if (points.length >= 5) return;
    const newPoints = [...points, newMainPoint(points.length)];
    updateOutline({ mainPoints: newPoints });
    const newIndex = newPoints.length - 1;
    setExpandedPoints((prev) => new Set([...prev, newIndex]));
    setActiveSection({ type: "point", index: newIndex });
  }

  function removePoint(index: number) {
    if (!sermon) return;
    const points = sermon.outline.mainPoints.filter((_, i) => i !== index);
    updateOutline({ mainPoints: points });
    setActiveSection({ type: "intro" });
  }

  function toggleStatus() {
    if (!sermon) return;
    const newStatus = sermon.status === "draft" ? "complete" : "draft";
    const updated: Sermon = { ...sermon, status: newStatus };
    setSermon(updated);
    scheduleAutoSave(updated);
  }

  function togglePoint(index: number) {
    setExpandedPoints((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-subtle border-t-accent" />
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <p className="text-text-muted">Sermon not found.</p>
        <Button variant="ghost" onClick={() => router.push("/sermon")}>
          Back to Sermons
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/sermon"
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-border-subtle" />
          <input
            value={sermon.title}
            onChange={(e) => {
              const updated = { ...sermon, title: e.target.value };
              setSermon(updated);
              scheduleAutoSave(updated);
            }}
            className="bg-transparent text-sm font-semibold text-text-primary focus:outline-none min-w-0 w-64 placeholder:text-text-muted"
            placeholder="Untitled Sermon"
          />
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} />
          <button
            onClick={toggleStatus}
            className={cn(
              "text-xs font-medium px-3 h-7 border transition-colors",
              sermon.status === "complete"
                ? "border-success/30 text-success bg-success/5 hover:bg-success/10"
                : "border-border-subtle text-text-muted hover:border-[#3a4052] hover:text-text-primary"
            )}
          >
            {sermon.status === "complete" ? "Complete" : "Mark Complete"}
          </button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: Outline Navigator */}
        <aside className="w-[300px] shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col overflow-y-auto">
          <div className="px-4 py-4 border-b border-border-subtle">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              Sermon Outline
            </p>
            {sermon.outline.scriptureRef && (
              <p className="text-xs text-accent mt-1">
                {sermon.outline.scriptureRef}
              </p>
            )}
          </div>

          <nav className="flex-1 py-3 flex flex-col gap-0.5">
            {/* Introduction */}
            <OutlineNavItem
              label="Introduction"
              active={activeSection.type === "intro"}
              onClick={() => setActiveSection({ type: "intro" })}
              detail={
                sermon.outline.introduction
                  ? `${sermon.outline.introduction.split(" ").length} words`
                  : "Empty"
              }
            />

            {/* Main Points */}
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Main Points
              </p>
            </div>
            {sermon.outline.mainPoints.map((point, i) => (
              <div key={point.id}>
                <button
                  onClick={() => {
                    setActiveSection({ type: "point", index: i });
                    togglePoint(i);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-100",
                    activeSection.type === "point" && activeSection.index === i
                      ? "bg-bg-elevated text-text-primary border-l-2 border-accent pl-[10px]"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 border-l-2 border-transparent pl-[10px]"
                  )}
                >
                  {expandedPoints.has(i) ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <span className="flex-1 truncate font-medium">
                    {i + 1}. {point.title || `Point ${i + 1}`}
                  </span>
                  <span className="text-xs text-text-muted shrink-0">
                    {point.subPoints.length > 0
                      ? `${point.subPoints.length} sub`
                      : ""}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePoint(i);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-danger transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </button>
                {expandedPoints.has(i) && point.subPoints.length > 0 && (
                  <div className="ml-8 pl-3 border-l border-border-subtle py-1">
                    {point.subPoints.map((sp, si) => (
                      <p key={si} className="text-xs text-text-muted py-0.5 truncate">
                        {sp || `Sub-point ${si + 1}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sermon.outline.mainPoints.length < 5 && (
              <button
                onClick={addPoint}
                className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-accent transition-colors ml-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Point
              </button>
            )}

            {/* Conclusion */}
            <div className="mt-2">
              <OutlineNavItem
                label="Conclusion"
                active={activeSection.type === "conclusion"}
                onClick={() => setActiveSection({ type: "conclusion" })}
                detail={
                  sermon.outline.conclusion
                    ? `${sermon.outline.conclusion.split(" ").length} words`
                    : "Empty"
                }
              />
            </div>
          </nav>

          {/* Build Slides button */}
          <div className="p-4 border-t border-border-subtle">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => router.push(`/sermon/${sermon.id}/slides`)}
            >
              <Layers className="h-4 w-4" />
              Build Slides
            </Button>
          </div>
        </aside>

        {/* CENTER: Editor */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-bg-base">
          {activeSection.type === "intro" && (
            <IntroductionEditor
              outline={sermon.outline}
              onChange={updateOutline}
            />
          )}
          {activeSection.type === "point" && (
            <MainPointEditor
              point={sermon.outline.mainPoints[activeSection.index]}
              index={activeSection.index}
              onChange={(patch) => updatePoint(activeSection.index, patch)}
            />
          )}
          {activeSection.type === "conclusion" && (
            <ConclusionEditor
              outline={sermon.outline}
              onChange={updateOutline}
            />
          )}
        </div>

        {/* RIGHT: Reference Panel */}
        <aside className="w-[268px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-y-auto">
          <div className="px-4 py-4 border-b border-border-subtle flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              References
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/rhema")}
              className="gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Rhema
            </Button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-text-muted mb-3">
                Cross-references
              </p>
              <div className="flex flex-col gap-2">
                {PLACEHOLDER_REFS.map((ref) => (
                  <div
                    key={ref.ref}
                    className="border border-border-subtle bg-bg-elevated/50 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-accent mb-0.5">
                      {ref.ref}
                    </p>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {ref.preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border-subtle pt-4">
              <p className="text-xs font-semibold text-text-muted mb-2">
                Sermon tools
              </p>
              <div className="flex flex-col gap-1.5">
                <button className="text-left px-3 py-2 text-xs text-text-muted border border-border-subtle hover:border-[#3a4052] hover:text-text-primary transition-colors flex items-center gap-2">
                  <BookOpen className="h-3 w-3" />
                  Browse commentaries
                </button>
                <button className="text-left px-3 py-2 text-xs text-text-muted border border-border-subtle hover:border-[#3a4052] hover:text-text-primary transition-colors flex items-center gap-2">
                  <ExternalLink className="h-3 w-3" />
                  Open in Rhema
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1.5 transition-colors",
        status === "saved" && "text-success",
        status === "saving" && "text-text-muted",
        status === "unsaved" && "text-text-muted"
      )}
    >
      {status === "saving" && (
        <span className="h-3 w-3 animate-spin rounded-full border border-text-muted border-t-transparent inline-block" />
      )}
      {status === "saved" && <Check className="h-3 w-3" />}
      {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved"}
    </span>
  );
}

function OutlineNavItem({
  label,
  active,
  onClick,
  detail,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  detail?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors duration-100",
        active
          ? "bg-bg-elevated text-text-primary border-l-2 border-accent pl-[10px]"
          : "text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 border-l-2 border-transparent pl-[10px]"
      )}
    >
      <span className="font-medium">{label}</span>
      {detail && <span className="text-xs text-text-muted">{detail}</span>}
    </button>
  );
}

function IntroductionEditor({
  outline,
  onChange,
}: {
  outline: SermonOutline;
  onChange: (patch: Partial<SermonOutline>) => void;
}) {
  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-lg font-bold text-text-primary mb-1">Introduction</h2>
      <p className="text-sm text-text-muted mb-6">
        Set the scene. Open with a hook, question, or story that draws the
        listener in.
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            Scripture Reference
          </label>
          <input
            value={outline.scriptureRef}
            onChange={(e) => onChange({ scriptureRef: e.target.value })}
            placeholder="e.g. Romans 8:28–39"
            className="h-9 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            Theme / Central Idea
          </label>
          <input
            value={outline.theme}
            onChange={(e) => onChange({ theme: e.target.value })}
            placeholder="The main idea in one sentence"
            className="h-9 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            Introduction Notes
          </label>
          <textarea
            value={outline.introduction}
            onChange={(e) => onChange({ introduction: e.target.value })}
            placeholder="How will you open? What story, question, or illustration will draw the congregation in?"
            rows={10}
            className="w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

function MainPointEditor({
  point,
  index,
  onChange,
}: {
  point: MainPoint;
  index: number;
  onChange: (patch: Partial<MainPoint>) => void;
}) {
  function addSubPoint() {
    onChange({ subPoints: [...point.subPoints, ""] });
  }

  function updateSubPoint(si: number, value: string) {
    const updated = [...point.subPoints];
    updated[si] = value;
    onChange({ subPoints: updated });
  }

  function removeSubPoint(si: number) {
    onChange({ subPoints: point.subPoints.filter((_, i) => i !== si) });
  }

  function addVerse() {
    const blank: VerseRef = {
      book: "",
      chapter: 1,
      verse: 1,
      text: "",
      translation: "ESV",
    };
    onChange({ verses: [...point.verses, blank] });
  }

  function updateVerse(vi: number, patch: Partial<VerseRef>) {
    const updated = point.verses.map((v, i) =>
      i === vi ? { ...v, ...patch } : v
    );
    onChange({ verses: updated });
  }

  function removeVerse(vi: number) {
    onChange({ verses: point.verses.filter((_, i) => i !== vi) });
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-accent uppercase tracking-widest">
          Point {index + 1}
        </span>
      </div>

      <Tabs.Root defaultValue="content" className="flex flex-col gap-0">
        <Tabs.List className="flex border-b border-border-subtle mb-6 gap-0">
          {["Content", "Verses", "Illustration", "Notes"].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab.toLowerCase()}
              className="px-4 py-2.5 text-sm text-text-muted border-b-2 border-transparent hover:text-text-primary transition-colors data-[state=active]:text-text-primary data-[state=active]:border-accent"
            >
              {tab}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="content" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              Point Title
            </label>
            <input
              value={point.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={`Point ${index + 1} title`}
              className="h-9 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Sub-points
              </label>
              <button
                onClick={addSubPoint}
                className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add sub-point
              </button>
            </div>
            {point.subPoints.length === 0 ? (
              <p className="text-sm text-text-muted py-2 italic">
                No sub-points yet. Add one to break this point down further.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {point.subPoints.map((sp, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-text-muted shrink-0 opacity-40" />
                    <input
                      value={sp}
                      onChange={(e) => updateSubPoint(si, e.target.value)}
                      placeholder={`Sub-point ${si + 1}`}
                      className="flex-1 h-8 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors"
                    />
                    <button
                      onClick={() => removeSubPoint(si)}
                      className="p-1 text-text-muted hover:text-danger transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="verses" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Attach scripture verses to this point
            </p>
            <button
              onClick={addVerse}
              className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add verse
            </button>
          </div>
          {point.verses.length === 0 ? (
            <div className="border border-dashed border-border-subtle p-6 text-center">
              <p className="text-sm text-text-muted">
                No verses attached. Add a verse to connect scripture to this
                point.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {point.verses.map((verse, vi) => (
                <div
                  key={vi}
                  className="bg-bg-elevated border border-border-subtle p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={verse.book}
                      onChange={(e) => updateVerse(vi, { book: e.target.value })}
                      placeholder="Book (e.g. John)"
                      className="flex-1 h-8 bg-bg-base border border-border-subtle px-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    />
                    <input
                      type="number"
                      value={verse.chapter}
                      onChange={(e) =>
                        updateVerse(vi, { chapter: Number(e.target.value) })
                      }
                      min={1}
                      className="w-16 h-8 bg-bg-base border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                    />
                    <span className="text-text-muted text-sm">:</span>
                    <input
                      type="number"
                      value={verse.verse}
                      onChange={(e) =>
                        updateVerse(vi, { verse: Number(e.target.value) })
                      }
                      min={1}
                      className="w-16 h-8 bg-bg-base border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                    />
                    <input
                      value={verse.translation}
                      onChange={(e) =>
                        updateVerse(vi, { translation: e.target.value })
                      }
                      placeholder="ESV"
                      className="w-16 h-8 bg-bg-base border border-border-subtle px-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={() => removeVerse(vi)}
                      className="p-1 text-text-muted hover:text-danger transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={verse.text}
                    onChange={(e) => updateVerse(vi, { text: e.target.value })}
                    placeholder="Paste the verse text here…"
                    rows={3}
                    className="w-full bg-bg-base border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent transition-colors leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="illustration" className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            Story, analogy, or real-world example that brings this point to
            life.
          </p>
          <textarea
            value={point.illustration}
            onChange={(e) => onChange({ illustration: e.target.value })}
            placeholder="Describe the illustration you'll use for this point…"
            rows={12}
            className="w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors leading-relaxed"
          />
        </Tabs.Content>

        <Tabs.Content value="notes" className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            Private notes, research, or anything you want to remember for this
            point.
          </p>
          <textarea
            value={point.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Research notes, commentary references, theological background…"
            rows={12}
            className="w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors leading-relaxed"
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function ConclusionEditor({
  outline,
  onChange,
}: {
  outline: SermonOutline;
  onChange: (patch: Partial<SermonOutline>) => void;
}) {
  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-lg font-bold text-text-primary mb-1">Conclusion</h2>
      <p className="text-sm text-text-muted mb-6">
        Land the plane. Summarize, call to action, and close with the
        gospel.
      </p>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            Concluding notes
          </label>
          <textarea
            value={outline.conclusion}
            onChange={(e) => onChange({ conclusion: e.target.value })}
            placeholder="How will you close? What's the call to action? What truth do you want to leave them with?"
            rows={10}
            className="w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

const PLACEHOLDER_REFS = [
  {
    ref: "Isaiah 55:10–11",
    preview: "So is my word that goes out from my mouth…",
  },
  {
    ref: "Hebrews 4:12",
    preview: "For the word of God is living and active…",
  },
  {
    ref: "2 Timothy 3:16–17",
    preview: "All Scripture is God-breathed and is useful…",
  },
  {
    ref: "Deuteronomy 8:3",
    preview: "Man does not live on bread alone but on every word…",
  },
];
