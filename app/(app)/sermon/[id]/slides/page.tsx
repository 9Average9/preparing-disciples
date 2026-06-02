"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  Save,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { getSermon } from "@/lib/sermons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Sermon, Slide, SlideTheme, SlideType, GrammarChange } from "@/types";

/* ── Vibe definitions ─────────────────────────────────── */
const VIBES = [
  {
    id: "sacred-classic",
    name: "Sacred & Classic",
    tagline: "Reverent, timeless",
    colors: ["#2c1a0e", "#c9a84c", "#f5e6c8"],
    guide: "Rich walnut background. Gold accent. Warm cream text. Serif fonts. Traditional and ornate.",
  },
  {
    id: "bold-powerful",
    name: "Bold & Powerful",
    tagline: "High-impact, commanding",
    colors: ["#0a0a0a", "#dc2626", "#ffffff"],
    guide: "Near-black background. Bold crimson accent. Pure white text. Sans-serif. Strong and authoritative.",
  },
  {
    id: "warm-inviting",
    name: "Warm & Inviting",
    tagline: "Welcoming, pastoral",
    colors: ["#fdf7f0", "#c17d3f", "#3d2b1f"],
    guide: "Warm ivory background. Amber accent. Deep brown text. Friendly and approachable.",
  },
  {
    id: "hope-renewal",
    name: "Hope & Renewal",
    tagline: "Fresh, uplifting",
    colors: ["#f0f7f4", "#2e8b57", "#1a3d2e"],
    guide: "Soft sage-white background. Forest green accent. Deep green text. Fresh and life-giving.",
  },
  {
    id: "midnight-glory",
    name: "Midnight Glory",
    tagline: "Mysterious, worshipful",
    colors: ["#0a0d18", "#6b7fe8", "#e8eaf6"],
    guide: "Deep midnight navy background. Soft indigo accent. Light blue-white text. Atmospheric and contemplative.",
  },
  {
    id: "sunrise-praise",
    name: "Sunrise & Praise",
    tagline: "Joyful, celebratory",
    colors: ["#fff8f0", "#e87c2e", "#2d1a0e"],
    guide: "Warm white background. Vibrant orange accent. Dark espresso text. Energetic and celebratory.",
  },
  {
    id: "regal-anointed",
    name: "Regal & Anointed",
    tagline: "Majestic, prophetic",
    colors: ["#100c1e", "#9b7fe8", "#f0ebff"],
    guide: "Deep purple-black background. Royal purple accent. Soft lavender-white text. Majestic and anointed.",
  },
  {
    id: "simple-truth",
    name: "Simple Truth",
    tagline: "Clean, focused",
    colors: ["#ffffff", "#3b82f6", "#1a1a2e"],
    guide: "Clean white background. Sky-blue accent. Near-black text. Minimal and clear. Sans-serif.",
  },
];

const DEFAULT_THEME: SlideTheme = {
  id: "default",
  name: "Default",
  description: "",
  preview: "",
  style: { bg: "#1a1612", text: "#f0ece4", accent: "#c9a84c", font: "serif" },
};

/* ── Default slide set ─────────────────────────────────── */
function buildDefaultSlides(sermon: Sermon): Slide[] {
  const slides: Slide[] = [
    {
      id: crypto.randomUUID(),
      type: "title",
      content: {
        heading: sermon.title,
        body: sermon.outline.scriptureRef || "",
      },
    },
    {
      id: crypto.randomUUID(),
      type: "scripture",
      content: {
        verseRef: sermon.outline.scriptureRef || "Scripture Reference",
        verseText:
          "Scripture text will appear here once you add verses in the sermon workshop.",
      },
    },
    ...sermon.outline.mainPoints.map(
      (point, i): Slide => ({
        id: crypto.randomUUID(),
        type: "point",
        content: {
          heading: `${i + 1}. ${point.title}`,
          body: point.subPoints.join("\n"),
        },
      })
    ),
    {
      id: crypto.randomUUID(),
      type: "custom",
      content: {
        heading: "Conclusion",
        body: sermon.outline.conclusion || "Closing thoughts and call to action.",
      },
    },
  ];
  return slides;
}

type GenerateStep =
  | "analyzing"
  | "designing"
  | "imagery"
  | "finalizing"
  | "done";

const GENERATE_STEPS: { key: GenerateStep; label: string }[] = [
  { key: "analyzing", label: "Analyzing sermon outline" },
  { key: "designing", label: "Designing slide layouts" },
  { key: "imagery", label: "Selecting imagery prompts" },
  { key: "finalizing", label: "Finalizing slides" },
];

export default function SlidesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeTheme, setActiveTheme] = useState<SlideTheme>(DEFAULT_THEME);
  const [selectedVibe, setSelectedVibe] = useState("sacred-classic");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generateStep, setGenerateStep] = useState<GenerateStep>("analyzing");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [grammarChanges, setGrammarChanges] = useState<GrammarChange[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSermon(id)
      .then((s) => {
        if (s) {
          setSermon(s);
          setSlides(buildDefaultSlides(s));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const activeSlide = slides[activeSlideIndex] ?? null;

  function addSlide() {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      type: "custom",
      content: { heading: "New Slide", body: "" },
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
  }

  function updateActiveSlide(patch: Partial<Slide>) {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex ? { ...s, ...patch } : s
      )
    );
  }

  async function handleGenerate() {
    if (!sermon) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateStep("analyzing");

    // Fire the API call immediately so it runs in parallel with the animation
    const fetchPromise = fetch("/api/slides/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outline: sermon.outline, theme: activeTheme, vibe: selectedVibe }),
    });

    // Animate through the first three steps while the API runs
    const animSteps: [GenerateStep, number][] = [
      ["analyzing", 900],
      ["designing", 1000],
      ["imagery", 900],
    ];
    for (const [step, ms] of animSteps) {
      setGenerateStep(step);
      await delay(ms);
    }
    // Hold "finalizing" while the actual fetch completes
    setGenerateStep("finalizing");

    try {
      const res = await fetchPromise;
      if (!res.ok) {
        setGenerateError("Generation failed — your outline slides are still here.");
        return;
      }
      const data = (await res.json()) as {
        slides: Slide[];
        grammarChanges: GrammarChange[];
        theme?: { bg: string; text: string; accent: string; font: string; name: string };
      };

      // Sanitize IDs: LLMs don't reliably emit valid/unique UUIDs.
      // Replace every AI-returned id with a real UUID and patch grammarChange refs.
      const idMap = new Map<string, string>();
      const sanitizedSlides = data.slides.map((s: Slide) => {
        const newId = crypto.randomUUID();
        idMap.set(s.id, newId);
        return { ...s, id: newId };
      });
      const sanitizedGrammar = (data.grammarChanges ?? []).map(
        (g: GrammarChange) => ({
          ...g,
          slideId: idMap.get(g.slideId) ?? g.slideId,
        })
      );

      setSlides(sanitizedSlides);
      setGrammarChanges(sanitizedGrammar);
      setActiveSlideIndex(0);
      if (data.theme) {
        setActiveTheme({
          id: "ai-generated",
          name: data.theme.name || "AI Generated",
          description: "",
          preview: "",
          style: {
            bg: data.theme.bg,
            text: data.theme.text,
            accent: data.theme.accent,
            font: data.theme.font || "sans",
          },
        });
      }
    } catch {
      setGenerateError("Network error — please check your connection and try again.");
    } finally {
      setGenerateStep("done");
      setGenerating(false);
    }
  }

  function acceptGrammarChange(slideId: string) {
    // Only act on the first unaccepted change for this slide (the one the user sees)
    const change = grammarChanges.find(
      (g) => g.slideId === slideId && !g.accepted
    );
    if (!change) return;

    setGrammarChanges((prev) =>
      prev.map((g) =>
        g === change ? { ...g, accepted: true } : g
      )
    );
    setSlides((prev) =>
      prev.map((s) => {
        if (s.id !== slideId) return s;
        const heading = s.content.heading?.replace(change.original, change.suggested);
        const body = s.content.body?.replace(change.original, change.suggested);
        return { ...s, content: { ...s.content, heading, body }, aiModified: true };
      })
    );
  }

  function rejectGrammarChange(slideId: string) {
    // Remove only the first unaccepted change for this slide
    const change = grammarChanges.find(
      (g) => g.slideId === slideId && !g.accepted
    );
    if (!change) return;
    setGrammarChanges((prev) => prev.filter((g) => g !== change));
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
    <div className="flex h-full flex-col bg-bg-base">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/sermon/${id}`}
            className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-1.5 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            {sermon.title}
          </Link>
          <div className="h-4 w-px bg-border-subtle" />
          <span className="text-sm text-text-muted">Slide Builder</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            {saved ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saved ? "Saved" : "Save"}
          </Button>
          <div
            className="relative group"
            title="PPTX export — coming soon"
          >
            <Button variant="secondary" size="sm" disabled>
              <Download className="h-3.5 w-3.5" />
              Export PPTX
            </Button>
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block z-10 whitespace-nowrap bg-bg-elevated border border-border-subtle px-3 py-1.5 text-xs text-text-muted">
              PPTX export — coming soon
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT RAIL: Slide list */}
        <aside className="w-[192px] shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b border-border-subtle">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              Slides
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setActiveSlideIndex(i)}
                className={cn(
                  "w-full text-left mb-2 border transition-all duration-150 rounded-lg overflow-hidden",
                  i === activeSlideIndex
                    ? "border-accent bg-accent/5 shadow-sm"
                    : "border-border-subtle bg-bg-elevated hover:border-accent/40 hover:shadow-sm"
                )}
              >
                <SlideThumbnail slide={slide} theme={activeTheme} />
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <span className="text-xs text-text-muted shrink-0">{i + 1}</span>
                  <span className="text-xs text-text-muted capitalize truncate">{slide.type}</span>
                  {slide.aiModified && (
                    <Sparkles className="h-2.5 w-2.5 text-accent shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-border-subtle">
            <button
              onClick={addSlide}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-text-muted border border-dashed border-border-subtle hover:border-accent/40 hover:text-text-primary transition-colors rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Slide
            </button>
          </div>
        </aside>

        {/* CENTER: Preview */}
        <div className="flex-1 min-w-0 flex flex-col bg-bg-base">
          {/* Grammar notification bar */}
          {grammarChanges.some((g) => !g.accepted) && !generating && (
            <div className="border-b border-accent/20 bg-accent/5 px-5 py-2.5 shrink-0 flex items-center gap-3 animate-fadeUp">
              <AlertCircle className="h-3.5 w-3.5 text-accent shrink-0" />
              <p className="text-xs text-text-primary flex-1">
                <span className="font-semibold text-accent">
                  {grammarChanges.filter((g) => !g.accepted).length}
                </span>{" "}
                grammar suggestion
                {grammarChanges.filter((g) => !g.accepted).length !== 1 ? "s" : ""}
                {" "}— select a slide on the left to review
              </p>
              <button
                onClick={() =>
                  setGrammarChanges((prev) => prev.map((g) => ({ ...g, accepted: true })))
                }
                className="text-xs text-accent hover:text-accent-hover font-medium transition-colors shrink-0"
              >
                Accept all
              </button>
              <button
                onClick={() => setGrammarChanges([])}
                className="text-xs text-text-muted hover:text-text-primary transition-colors shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          <div key={activeSlideIndex} className="flex-1 flex items-center justify-center p-8 animate-fadeUp">
            {activeSlide ? (
              <SlidePreview slide={activeSlide} theme={activeTheme} />
            ) : (
              <p className="text-text-muted text-sm">No slides yet.</p>
            )}
          </div>
        </div>

        {/* RIGHT: Properties */}
        <aside className="w-[268px] shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col overflow-y-auto">
          <div className="px-4 py-4 border-b border-border-subtle flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              Slide Properties
            </p>
          </div>

          {activeSlide ? (
            <div className="p-4 flex flex-col gap-5">
              {/* Slide type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                  Slide Type
                </label>
                <select
                  value={activeSlide.type}
                  onChange={(e) =>
                    updateActiveSlide({ type: e.target.value as SlideType })
                  }
                  className="h-9 bg-bg-elevated border border-border-subtle px-2 text-sm text-text-primary focus:outline-none focus:border-accent rounded-lg"
                >
                  {(
                    [
                      "title",
                      "scripture",
                      "point",
                      "illustration",
                      "quote",
                      "custom",
                    ] as SlideType[]
                  ).map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Heading */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                  Heading
                </label>
                <input
                  value={activeSlide.content.heading ?? ""}
                  onChange={(e) =>
                    updateActiveSlide({
                      content: {
                        ...activeSlide.content,
                        heading: e.target.value,
                      },
                    })
                  }
                  className="h-9 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent rounded-lg"
                  placeholder="Slide heading"
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                  Body
                </label>
                <textarea
                  value={activeSlide.content.body ?? ""}
                  onChange={(e) =>
                    updateActiveSlide({
                      content: {
                        ...activeSlide.content,
                        body: e.target.value,
                      },
                    })
                  }
                  rows={4}
                  className="bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none rounded-lg"
                  placeholder="Body text"
                />
              </div>

              {/* Verse ref (if scripture type) */}
              {activeSlide.type === "scripture" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                    Verse Reference
                  </label>
                  <input
                    value={activeSlide.content.verseRef ?? ""}
                    onChange={(e) =>
                      updateActiveSlide({
                        content: {
                          ...activeSlide.content,
                          verseRef: e.target.value,
                        },
                      })
                    }
                    className="h-9 bg-bg-elevated border border-border-subtle px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent rounded-lg"
                    placeholder="e.g. John 3:16"
                  />
                  <textarea
                    value={activeSlide.content.verseText ?? ""}
                    onChange={(e) =>
                      updateActiveSlide({
                        content: {
                          ...activeSlide.content,
                          verseText: e.target.value,
                        },
                      })
                    }
                    rows={3}
                    className="bg-bg-elevated border border-border-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none rounded-lg"
                    placeholder="Verse text"
                  />
                </div>
              )}

              {/* Background image */}
              <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                  Background Image
                </label>
                {activeSlide.backgroundImage ? (
                  <div className="relative aspect-video bg-bg-elevated border border-border-subtle overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSlide.backgroundImage}
                      alt="Background"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-bg-elevated border border-dashed border-border-subtle flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-border-subtle" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 text-xs text-text-muted border border-border-subtle hover:border-[#3a4052] hover:text-text-primary transition-colors">
                    Change Image
                  </button>
                  <button className="flex-1 py-1.5 text-xs text-accent border border-accent/30 hover:bg-accent/5 transition-colors flex items-center justify-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Generate
                  </button>
                </div>
                {activeSlide.content.imagePrompt && (
                  <p className="text-xs text-text-muted italic">
                    Prompt: {activeSlide.content.imagePrompt}
                  </p>
                )}
              </div>

              {/* AI grammar suggestion */}
              {(() => {
                const change = grammarChanges.find(
                  (g) => g.slideId === activeSlide.id && !g.accepted
                );
                if (!change) return null;
                return (
                  <div className="border border-accent/30 bg-accent/5 p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-accent" />
                      <span className="text-xs font-semibold text-accent uppercase tracking-widest">
                        AI Adjusted
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">{change.reason}</p>
                    <div className="flex flex-col gap-1">
                      <div className="text-xs bg-danger/5 border border-danger/20 px-2 py-1 line-through text-text-muted">
                        {change.original}
                      </div>
                      <div className="text-xs bg-success/5 border border-success/20 px-2 py-1 text-text-primary">
                        {change.suggested}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptGrammarChange(activeSlide.id)}
                        className="flex-1 py-1 text-xs text-success border border-success/30 hover:bg-success/5 transition-colors flex items-center justify-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Accept
                      </button>
                      <button
                        onClick={() => rejectGrammarChange(activeSlide.id)}
                        className="flex-1 py-1 text-xs text-text-muted border border-border-subtle hover:border-[#3a4052] transition-colors flex items-center justify-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="p-4 text-sm text-text-muted">
              Select a slide to edit its properties.
            </div>
          )}

          {/* Vibe picker */}
          <div className="border-t border-border-subtle p-4 shrink-0">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">
              Style Vibe
            </p>
            <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
              AI crafts a unique color theme for this vibe and sermon.
            </p>
            <VibePicker
              vibes={VIBES}
              selected={selectedVibe}
              onSelect={setSelectedVibe}
            />
          </div>

          {/* Generate button */}
          <div className="border-t border-border-subtle p-4 mt-auto shrink-0">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              loading={generating}
            >
              <Sparkles className="h-4 w-4" />
              Generate Slides
            </Button>
            <p className="text-xs text-text-muted text-center mt-2">
              {VIBES.find((v) => v.id === selectedVibe)?.name} theme + custom slides
            </p>
          </div>
        </aside>
      </div>

      {/* Generate Loading Modal */}
      {generating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-10 w-full max-w-sm flex flex-col items-center gap-6">
            <div className="flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-border-subtle border-t-accent" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-text-primary mb-1">
                Building your presentation…
              </h3>
              <p className="text-sm text-text-muted">This takes just a moment</p>
            </div>
            <div className="w-full flex flex-col gap-2">
              {GENERATE_STEPS.map((step) => {
                // "done" means all complete; use length so all steps are < it
                const currentIndex =
                  generateStep === "done"
                    ? GENERATE_STEPS.length
                    : GENERATE_STEPS.findIndex((s) => s.key === generateStep);
                const stepIndex = GENERATE_STEPS.findIndex(
                  (s) => s.key === step.key
                );
                const isComplete = stepIndex < currentIndex;
                const isActive = step.key === generateStep;
                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-3 py-1",
                      isActive
                        ? "text-text-primary"
                        : isComplete
                          ? "text-success"
                          : "text-text-muted"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : isActive ? (
                      <div className="h-4 w-4 animate-spin rounded-full border border-accent border-t-transparent shrink-0" />
                    ) : (
                      <div className="h-4 w-4 shrink-0 rounded-full border border-border-subtle" />
                    )}
                    <span className="text-sm">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Error toast — shown after modal closes if generation failed */}
      {generateError && !generating && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border border-danger/25 bg-bg-surface max-w-sm w-full mx-4">
          <AlertCircle className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm text-text-primary flex-1">{generateError}</p>
          <button
            onClick={() => setGenerateError(null)}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Slide Preview ──────────────────────────────────────── */
/* ── Slide Rendering Engine ─────────────────────────────── */

type SlideProps = {
  slide: Slide;
  bg: string;
  text: string;
  accent: string;
  serif: boolean;
};

function SlidePreview({ slide, theme }: { slide: Slide; theme: SlideTheme }) {
  const props: SlideProps = {
    slide,
    bg: theme.style.bg as string,
    text: theme.style.text as string,
    accent: theme.style.accent as string,
    serif: theme.style.font === "serif",
  };
  return (
    <div
      className="w-full max-w-3xl aspect-video relative overflow-hidden select-none"
      style={{
        backgroundColor: props.bg,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {slide.backgroundImage && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${slide.backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.18,
          }}
        />
      )}
      {slide.type === "title" && <TitleLayout {...props} />}
      {slide.type === "scripture" && <ScriptureLayout {...props} />}
      {slide.type === "point" && <PointLayout {...props} />}
      {slide.type === "quote" && <QuoteLayout {...props} />}
      {slide.type === "illustration" && <IllustrationLayout {...props} />}
      {(slide.type === "custom" ||
        !["title","scripture","point","quote","illustration"].includes(slide.type)) && (
        <CustomLayout {...props} />
      )}
    </div>
  );
}

/* Title — radial glows, ornamental divider, pill badge */
function TitleLayout({ slide, bg, text, accent, serif }: SlideProps) {
  const ff = serif ? "Georgia,'Times New Roman',serif" : "var(--font-inter),sans-serif";
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${bg} 30%,${accent}18 100%)` }} />
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full" style={{ background: `radial-gradient(circle,${accent}22 0%,transparent 65%)` }} />
      <div className="absolute -bottom-12 -left-12 w-52 h-52 rounded-full" style={{ background: `radial-gradient(circle,${accent}14 0%,transparent 65%)` }} />
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-20 text-center">
        <div className="text-[9px] font-bold tracking-[0.22em] uppercase mb-5 px-3 py-1 rounded-full" style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}38` }}>
          Sermon
        </div>
        <h1 className="font-bold leading-tight mb-5" style={{ color: text, fontFamily: ff, fontSize: "clamp(1.4rem,3.2vw,2.3rem)" }}>
          {slide.content.heading || "Untitled"}
        </h1>
        <div className="flex items-center gap-2 mb-4" style={{ width: 72 }}>
          <div className="h-px flex-1" style={{ background: accent }} />
          <div className="rounded-full" style={{ width: 5, height: 5, background: accent }} />
          <div className="h-px flex-1" style={{ background: accent }} />
        </div>
        {(slide.content.body || slide.content.verseRef) && (
          <p className="font-semibold tracking-widest text-[10px] uppercase" style={{ color: accent }}>
            {slide.content.body || slide.content.verseRef}
          </p>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 4, background: accent }} />
    </>
  );
}

/* Scripture — giant faded quote mark, italic verse */
function ScriptureLayout({ slide, bg, text, accent, serif }: SlideProps) {
  const ff = serif ? "Georgia,'Times New Roman',serif" : "var(--font-inter),sans-serif";
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${accent}0c 0%,transparent 55%)` }} />
      <div className="absolute pointer-events-none select-none" style={{ top: -24, left: 8, fontSize: 260, color: accent, opacity: 0.08, fontFamily: "Georgia,serif", lineHeight: 1 }}>&ldquo;</div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-20 text-center">
        {slide.content.verseText ? (
          <>
            <p className="italic leading-relaxed mb-6" style={{ color: text, fontFamily: ff, fontSize: "clamp(0.9rem,1.9vw,1.25rem)", opacity: 0.93 }}>
              &ldquo;{slide.content.verseText}&rdquo;
            </p>
            {slide.content.verseRef && (
              <p className="font-bold tracking-[0.18em] text-[10px] uppercase" style={{ color: accent }}>
                — {slide.content.verseRef}
              </p>
            )}
          </>
        ) : (
          <>
            {slide.content.heading && <h2 className="font-bold text-2xl mb-3" style={{ color: text, fontFamily: ff }}>{slide.content.heading}</h2>}
            {slide.content.body && <p className="italic text-base opacity-80 leading-relaxed" style={{ color: text }}>{slide.content.body}</p>}
          </>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: accent }} />
    </>
  );
}

/* Point — left accent bar, heading, bullet list */
function PointLayout({ slide, bg, text, accent, serif }: SlideProps) {
  const ff = serif ? "Georgia,'Times New Roman',serif" : "var(--font-inter),sans-serif";
  const lines = (slide.content.body ?? "").split("\n").filter(Boolean).slice(0, 4);
  return (
    <>
      <div className="absolute bottom-0 right-0 w-56 h-56" style={{ background: `radial-gradient(circle at bottom right,${accent}10 0%,transparent 65%)` }} />
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 5, background: accent }} />
      <div className="relative z-10 h-full flex flex-col justify-center pl-14 pr-12">
        <h2 className="font-bold leading-tight mb-5" style={{ color: text, fontFamily: ff, fontSize: "clamp(1.2rem,2.8vw,1.8rem)" }}>
          {slide.content.heading}
        </h2>
        {lines.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1.5 shrink-0 rounded-full" style={{ width: 6, height: 6, background: accent, opacity: 0.75 }} />
                <span className="leading-snug" style={{ color: text, opacity: 0.82, fontSize: "clamp(0.75rem,1.4vw,0.95rem)" }}>
                  {line.replace(/^[•\-\d.]\s*/, "")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: accent }} />
    </>
  );
}

/* Quote — decorative marks, centered italic */
function QuoteLayout({ slide, bg, text, accent, serif }: SlideProps) {
  const ff = serif ? "Georgia,'Times New Roman',serif" : "var(--font-inter),sans-serif";
  const quoteText = slide.content.body || slide.content.heading || "";
  const attribution = slide.content.body && slide.content.heading ? slide.content.heading : null;
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${accent}0a 0%,transparent 55%)` }} />
      <div className="absolute pointer-events-none select-none" style={{ top: -14, left: 12, fontSize: 220, color: accent, opacity: 0.09, fontFamily: "Georgia,serif", lineHeight: 1 }}>&ldquo;</div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-16 text-center">
        <p className="italic leading-relaxed mb-5" style={{ color: text, fontFamily: ff, fontSize: "clamp(0.95rem,2vw,1.3rem)" }}>
          &ldquo;{quoteText}&rdquo;
        </p>
        {attribution && (
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: accent }}>
            — {attribution}
          </p>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: accent }} />
    </>
  );
}

/* Illustration — split panel: accent left + text right */
function IllustrationLayout({ slide, bg, text, accent, serif }: SlideProps) {
  const ff = serif ? "Georgia,'Times New Roman',serif" : "var(--font-inter),sans-serif";
  return (
    <>
      <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center" style={{ width: "38%", background: `linear-gradient(160deg,${accent}60 0%,${accent}2e 100%)` }}>
        <svg viewBox="0 0 40 40" fill="none" style={{ width: 52, height: 52, opacity: 0.28 }} stroke={text} strokeWidth="1.2">
          <path d="M20 5v30M10 14h20" strokeLinecap="round" />
        </svg>
      </div>
      <div className="absolute top-0 bottom-0 right-0 flex flex-col justify-center pr-10" style={{ left: "42%" }}>
        {slide.content.heading && (
          <h2 className="font-bold leading-tight mb-4" style={{ color: text, fontFamily: ff, fontSize: "clamp(1rem,2.4vw,1.5rem)" }}>
            {slide.content.heading}
          </h2>
        )}
        {slide.content.body && (
          <p className="leading-relaxed" style={{ color: text, opacity: 0.78, fontSize: "clamp(0.75rem,1.4vw,0.93rem)" }}>
            {slide.content.body}
          </p>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: accent }} />
    </>
  );
}

/* Custom — gradient corner, centered */
function CustomLayout({ slide, bg, text, accent, serif }: SlideProps) {
  const ff = serif ? "Georgia,'Times New Roman',serif" : "var(--font-inter),sans-serif";
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${accent}09 0%,transparent 60%)` }} />
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full" style={{ background: `radial-gradient(circle,${accent}12 0%,transparent 65%)` }} />
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-16 text-center">
        {slide.content.heading && (
          <h2 className="font-bold leading-tight mb-5" style={{ color: text, fontFamily: ff, fontSize: "clamp(1.3rem,2.8vw,2rem)" }}>
            {slide.content.heading}
          </h2>
        )}
        {slide.content.body && (
          <p className="leading-relaxed" style={{ color: text, opacity: 0.8, fontSize: "clamp(0.85rem,1.5vw,1.05rem)" }}>
            {slide.content.body}
          </p>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: accent }} />
    </>
  );
}

/* ── Miniature thumbnail for left rail ───────────────────── */
function SlideThumbnail({ slide, theme }: { slide: Slide; theme: SlideTheme }) {
  const bg = theme.style.bg as string;
  const text = theme.style.text as string;
  const accent = theme.style.accent as string;
  return (
    <div className="w-full aspect-video relative overflow-hidden" style={{ background: bg }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${accent}14 0%,transparent 70%)` }} />
      {slide.type === "title" && (
        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-1 px-3">
          <div className="h-1 rounded-full w-10" style={{ background: accent, opacity: 0.7 }} />
          <div className="h-1.5 rounded-full w-16" style={{ background: text, opacity: 0.7 }} />
          <div className="h-1 rounded-full w-8" style={{ background: accent, opacity: 0.5 }} />
        </div>
      )}
      {slide.type === "scripture" && (
        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-1 px-3">
          <div className="absolute left-1 top-0 text-2xl leading-none pointer-events-none" style={{ color: accent, opacity: 0.18, fontFamily: "Georgia,serif" }}>&ldquo;</div>
          <div className="h-1 rounded-full w-14" style={{ background: text, opacity: 0.5 }} />
          <div className="h-1 rounded-full w-12" style={{ background: text, opacity: 0.4 }} />
          <div className="h-1 rounded-full w-6" style={{ background: accent, opacity: 0.7 }} />
        </div>
      )}
      {slide.type === "point" && (
        <>
          <div className="absolute left-0 top-0 bottom-0" style={{ width: 2, background: accent }} />
          <div className="relative z-10 h-full flex flex-col justify-center pl-3 pr-2 gap-1.5">
            <div className="h-1.5 rounded-full w-12" style={{ background: text, opacity: 0.65 }} />
            <div className="flex items-center gap-1">
              <div className="rounded-full shrink-0" style={{ width: 3, height: 3, background: accent, opacity: 0.7 }} />
              <div className="h-1 rounded-full w-8" style={{ background: text, opacity: 0.4 }} />
            </div>
            <div className="flex items-center gap-1">
              <div className="rounded-full shrink-0" style={{ width: 3, height: 3, background: accent, opacity: 0.7 }} />
              <div className="h-1 rounded-full w-6" style={{ background: text, opacity: 0.4 }} />
            </div>
          </div>
        </>
      )}
      {(slide.type === "quote" || slide.type === "illustration" || slide.type === "custom") && (
        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-1 px-3">
          <div className="h-1.5 rounded-full w-14" style={{ background: text, opacity: 0.6 }} />
          <div className="h-1 rounded-full w-10" style={{ background: text, opacity: 0.4 }} />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: accent }} />
    </div>
  );
}

/* ── Vibe picker component ───────────────────────────────── */
function VibePicker({
  vibes,
  selected,
  onSelect,
}: {
  vibes: typeof VIBES;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {vibes.map((vibe) => (
        <button
          key={vibe.id}
          onClick={() => onSelect(vibe.id)}
          className={cn(
            "flex flex-col gap-1.5 p-2 border transition-colors duration-100 text-left rounded-lg",
            selected === vibe.id
              ? "border-accent bg-accent/5"
              : "border-border-subtle hover:border-[#3a4052]"
          )}
        >
          <div className="flex gap-0.5 rounded-sm overflow-hidden h-3">
            {vibe.colors.map((c, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <p className="text-[10px] font-semibold text-text-primary leading-tight">
            {vibe.name}
          </p>
          <p className="text-[9px] text-text-muted leading-tight">{vibe.tagline}</p>
        </button>
      ))}
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
