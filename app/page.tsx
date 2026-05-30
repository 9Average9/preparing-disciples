"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { BookOpen, Layers, Search } from "lucide-react";

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
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-subtle border-t-accent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-10 py-5 border-b border-border-subtle">
        <Logomark />
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="h-9 px-5 inline-flex items-center text-sm font-medium text-text-muted border border-border-subtle hover:border-[#3a4052] hover:text-text-primary transition-colors duration-150"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="h-9 px-5 inline-flex items-center text-sm font-semibold bg-accent text-bg-base hover:bg-accent-hover transition-colors duration-150"
          >
            Create Account
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 border border-accent/30 bg-accent/5 text-accent text-xs font-medium tracking-widest uppercase">
            <span className="h-1 w-1 rounded-full bg-accent" />
            Disciple Builder Tools
          </div>

          <h1 className="text-6xl font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
            From study to sermon.
            <br />
            <span className="text-accent">Every word yours.</span>
          </h1>

          <p className="text-xl text-text-muted leading-relaxed mb-10 max-w-xl mx-auto">
            A professional sermon preparation workspace with Greek text tools,
            an AI-assisted slide builder, and a structured outline workshop —
            all in one focused environment.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="h-12 px-8 inline-flex items-center text-base font-semibold bg-accent text-bg-base hover:bg-accent-hover transition-colors duration-150"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="h-12 px-8 inline-flex items-center text-base font-medium text-text-muted border border-border-subtle hover:border-[#3a4052] hover:text-text-primary transition-colors duration-150"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="mt-20 grid grid-cols-3 gap-px bg-border-subtle border border-border-subtle max-w-3xl w-full mx-auto">
          <FeatureCell
            icon={<Search className="h-5 w-5 text-accent" />}
            title="Rhema Greek Tools"
            description="Septuagint (LXX) and New Testament (NA28) with lexicon, word studies, and syntax diagrams."
          />
          <FeatureCell
            icon={<BookOpen className="h-5 w-5 text-accent" />}
            title="Sermon Workshop"
            description="Structured outline builder with inline editing, scripture references, and auto-save."
          />
          <FeatureCell
            icon={<Layers className="h-5 w-5 text-accent" />}
            title="AI Slide Builder"
            description="Generate presentation slides from your outline. Export to PowerPoint with one click."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-10 py-5 border-t border-border-subtle flex items-center justify-between">
        <span className="text-xs text-text-muted">
          &copy; {new Date().getFullYear()} Disciple Builder. All rights
          reserved.
        </span>
        <span className="text-xs text-text-muted">
          Preparing Disciples &mdash; A professional sermon preparation tool
        </span>
      </footer>
    </div>
  );
}

function Logomark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-8 w-8 flex items-center justify-center bg-accent/10 border border-accent/30">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          stroke="#c9a84c"
          strokeWidth="1.5"
        >
          {/* Cross + book motif */}
          <path d="M12 3v18M7 8h10" strokeLinecap="round" />
          <path d="M5 14h6v5H5z" strokeLinecap="square" />
          <path d="M13 14h6v5h-6z" strokeLinecap="square" />
        </svg>
      </div>
      <span className="text-base font-semibold tracking-tight text-text-primary">
        Preparing Disciples
      </span>
    </div>
  );
}

function FeatureCell({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-bg-surface px-7 py-8">
      <div className="mb-4">{icon}</div>
      <h3 className="text-sm font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}
