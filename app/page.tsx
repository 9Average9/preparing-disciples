"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { BookOpen, Layers, Search, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{
            borderColor: "var(--border-subtle)",
            borderTopColor: "var(--accent)",
          }}
        />
      </div>
    );
  }

  if (user) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-4 border-b"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "0 1px 0 var(--border-subtle)",
        }}
      >
        <Logomark />
        <nav className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="h-9 px-5 inline-flex items-center text-sm font-medium rounded-xl transition-all duration-150"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                "var(--text-primary)";
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="h-9 px-5 inline-flex items-center text-sm font-semibold rounded-xl transition-all duration-150 hover:opacity-90"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--bg-surface)",
              boxShadow: "0 2px 8px rgba(184,144,63,0.25)",
            }}
          >
            Get Started Free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full text-xs font-semibold tracking-wider uppercase"
            style={{
              border: "1px solid rgba(184,144,63,0.25)",
              backgroundColor: "rgba(184,144,63,0.08)",
              color: "var(--accent)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
            />
            Disciple Builder Tools
          </div>

          <h1
            className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            From study to sermon.
            <br />
            <span style={{ color: "var(--accent)" }}>Every word yours.</span>
          </h1>

          <p
            className="text-lg sm:text-xl leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            A professional sermon preparation workspace with Greek text tools,
            an AI-assisted slide builder, and a structured outline workshop —
            all in one focused environment.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="h-12 px-8 inline-flex items-center gap-2 text-base font-semibold rounded-xl transition-all duration-150 hover:opacity-90 hover:-translate-y-px"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--bg-surface)",
                boxShadow: "0 4px 16px rgba(184,144,63,0.28)",
              }}
            >
              Start Preparing
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="h-12 px-8 inline-flex items-center text-base font-medium rounded-xl transition-all duration-150"
              style={{
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-primary)";
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-muted)";
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
              }}
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="mt-20 max-w-3xl w-full mx-auto grid grid-cols-3 gap-4">
          <FeatureCard
            icon={<Search className="h-5 w-5" />}
            title="Rhema Greek Tools"
            description="Septuagint & New Testament with lexicon, word studies, and syntax diagrams."
          />
          <FeatureCard
            icon={<BookOpen className="h-5 w-5" />}
            title="Sermon Workshop"
            description="Structured outline builder with inline editing, scripture refs, and auto-save."
          />
          <FeatureCard
            icon={<Layers className="h-5 w-5" />}
            title="AI Slide Builder"
            description="Generate presentation slides from your outline. Export to PowerPoint in one click."
          />
        </div>
      </main>

      {/* Footer */}
      <footer
        className="px-8 py-4 border-t flex items-center justify-between"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          &copy; {new Date().getFullYear()} Disciple Builder. All rights reserved.
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Preparing Disciples &mdash; Sermon preparation workspace
        </span>
      </footer>
    </div>
  );
}

function Logomark() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-9 w-9 flex items-center justify-center rounded-xl"
        style={{
          backgroundColor: "rgba(184,144,63,0.12)",
          border: "1px solid rgba(184,144,63,0.22)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          stroke="var(--accent)"
          strokeWidth="1.5"
        >
          <path d="M12 3v18M7 8h10" strokeLinecap="round" />
          <path d="M5 14h6v5H5z" strokeLinecap="square" />
          <path d="M13 14h6v5h-6z" strokeLinecap="square" />
        </svg>
      </div>
      <span
        className="text-base font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        Preparing Disciples
      </span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="flex flex-col gap-4 px-6 py-7 rounded-2xl transition-all duration-200"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center"
        style={{
          backgroundColor: "rgba(184,144,63,0.10)",
          color: "var(--accent)",
          border: "1px solid rgba(184,144,63,0.15)",
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          className="text-sm font-semibold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}
