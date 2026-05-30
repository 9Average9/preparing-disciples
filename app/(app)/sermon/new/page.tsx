"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    <div className="p-8 max-w-2xl">
      {/* Breadcrumb */}
      <Link
        href="/sermon"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-8"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Sermons
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          New Sermon
        </h1>
        <p className="text-sm text-text-muted">
          Fill in the basics — you can always edit everything in the workshop.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-bg-surface border border-border-subtle p-8 flex flex-col gap-6"
      >
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
          <label className="text-sm font-medium text-text-muted">
            Theme / brief description
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. Jesus presents himself as the true sustenance for the human soul — sufficient where manna was not."
            rows={3}
            className="w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent hover:border-[#3a4052] transition-colors"
          />
          <p className="text-xs text-text-muted">
            One or two sentences on the central idea
          </p>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
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

      {/* Example starters */}
      <div className="mt-6">
        <p className="text-xs text-text-muted mb-3 uppercase tracking-widest font-semibold">
          Example starters
        </p>
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
              className="text-left px-4 py-3 bg-bg-surface border border-border-subtle hover:border-[#3a4052] hover:bg-bg-elevated transition-colors group"
            >
              <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                {ex.title}
              </span>
              <span className="text-xs text-text-muted ml-2">{ex.ref}</span>
            </button>
          ))}
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
