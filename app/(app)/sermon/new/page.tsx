"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Wand2 } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { createSermon } from "@/lib/sermons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SermonOutline } from "@/types";

const EMPTY_OUTLINE: SermonOutline = {
  introduction: "",
  mainPoints: [],
  conclusion: "",
  scriptureRef: "",
  theme: "",
  illustrations: [],
};

export default function NewSermonPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [scriptureRef, setScriptureRef] = useState("");
  const [theme, setTheme] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      setError("Please enter a sermon title.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const outline: SermonOutline = {
        ...EMPTY_OUTLINE,
        scriptureRef: scriptureRef.trim(),
        theme: theme.trim(),
      };
      const sermon = await createSermon(user.uid, title.trim(), outline);
      router.push(`/sermon/${sermon.id}`);
    } catch {
      setError("Failed to create sermon. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full overflow-y-auto rounded-2xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-xl mx-auto px-8 py-8">
        {/* Back link */}
        <Link
          href="/sermon"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors mb-8"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Sermons
        </Link>

        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            New Sermon
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Fill in the basics — you can always edit everything in the workshop.
          </p>
        </div>

        <div
          className="rounded-2xl p-7 flex flex-col gap-6 mb-6"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Input
              label="Sermon title"
              type="text"
              placeholder="e.g. The Bread of Life"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <Input
              label="Primary scripture reference"
              type="text"
              placeholder="e.g. John 6:35–51"
              value={scriptureRef}
              onChange={(e) => setScriptureRef(e.target.value)}
              hint="The main passage this sermon is drawn from"
            />

            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Theme / brief description
              </label>
              <textarea
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. Jesus presents himself as the true sustenance for the human soul — sufficient where manna was not."
                rows={3}
                className="w-full px-3.5 py-2.5 text-sm resize-none rounded-xl transition-all duration-150 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  "--tw-ring-color": "rgba(184,144,63,0.2)",
                } as React.CSSProperties}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                One or two sentences on the central idea
              </p>
            </div>

            {error && (
              <div
                className="px-3.5 py-2.5 rounded-xl text-sm"
                style={{
                  color: "var(--danger)",
                  backgroundColor: "rgba(192,57,43,0.06)",
                  border: "1px solid rgba(192,57,43,0.18)",
                }}
              >
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
              >
                Create Sermon
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Example starters */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Quick starters
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {EXAMPLE_SERMONS.map((ex) => (
              <button
                key={ex.title}
                type="button"
                onClick={() => {
                  setTitle(ex.title);
                  setScriptureRef(ex.ref);
                  setTheme(ex.theme);
                }}
                className="text-left px-4 py-3 rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(184,144,63,0.3)";
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--bg-surface)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border-subtle)";
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--bg-elevated)";
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {ex.title}
                </span>
                <span
                  className="text-xs ml-2"
                  style={{ color: "var(--accent)", opacity: 0.8 }}
                >
                  {ex.ref}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const EXAMPLE_SERMONS = [
  {
    title: "The Bread of Life",
    ref: "John 6:35–51",
    theme:
      "Jesus presents himself as the true sustenance for the human soul — sufficient where manna was not.",
  },
  {
    title: "Walking Through the Valley",
    ref: "Psalm 23",
    theme:
      "God's presence does not remove suffering but accompanies us through it with rod and staff.",
  },
  {
    title: "Faith That Moves Mountains",
    ref: "Matthew 17:14–21",
    theme:
      "Even small, genuine faith accomplishes what no amount of striving can achieve on its own.",
  },
];
