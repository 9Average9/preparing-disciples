"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, Search, ArrowRight } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { getUserSermons } from "@/lib/sermons";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Sermon } from "@/types";

export default function DashboardPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserSermons(user.uid)
      .then((s) => setSermons(s.slice(0, 3)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName =
    user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Pastor";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-1">
          {greeting}, {firstName}.
        </h1>
        <p className="text-text-muted text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Quick actions */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            href="/sermon/new"
            icon={<Plus className="h-5 w-5" />}
            label="New Sermon"
            description="Start a new sermon outline"
            accent
          />
          <QuickAction
            href="/rhema"
            icon={<span className="font-serif text-lg leading-none">Ρ</span>}
            label="Open Rhema"
            description="Greek text tools and lexicon"
          />
          <QuickAction
            href="/study"
            icon={<Search className="h-5 w-5" />}
            label="Browse Studies"
            description="Passage search and study notes"
          />
        </div>
      </section>

      {/* Recent sermons */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            Recent Sermons
          </h2>
          <Link
            href="/sermon"
            className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-36 bg-bg-surface border border-border-subtle animate-pulse"
              />
            ))}
          </div>
        ) : sermons.length === 0 ? (
          <EmptySermons />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {sermons.map((sermon) => (
              <SermonCard
                key={sermon.id}
                sermon={sermon}
                onClick={() => router.push(`/sermon/${sermon.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  description,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-4 p-5 border transition-colors duration-150 group ${
        accent
          ? "bg-accent/5 border-accent/30 hover:bg-accent/10 hover:border-accent/50"
          : "bg-bg-surface border-border-subtle hover:bg-bg-elevated hover:border-[#3a4052]"
      }`}
    >
      <div
        className={`mt-0.5 shrink-0 ${accent ? "text-accent" : "text-text-muted group-hover:text-text-primary"} transition-colors`}
      >
        {icon}
      </div>
      <div>
        <p
          className={`text-sm font-semibold mb-0.5 ${accent ? "text-accent" : "text-text-primary"}`}
        >
          {label}
        </p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </Link>
  );
}

function SermonCard({
  sermon,
  onClick,
}: {
  sermon: Sermon;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-bg-surface border border-border-subtle p-5 hover:bg-bg-elevated hover:border-[#3a4052] transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
        <Badge variant={sermon.status === "complete" ? "complete" : "draft"}>
          {sermon.status}
        </Badge>
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1 line-clamp-2 group-hover:text-accent transition-colors">
        {sermon.title}
      </h3>
      {sermon.outline.scriptureRef && (
        <p className="text-xs text-text-muted mb-3">
          {sermon.outline.scriptureRef}
        </p>
      )}
      <p className="text-xs text-text-muted mt-auto">
        {formatDate(sermon.updatedAt)}
      </p>
    </button>
  );
}

function EmptySermons() {
  return (
    <div className="border border-dashed border-border-subtle bg-bg-surface/50 p-10 flex flex-col items-center text-center">
      <BookOpen className="h-8 w-8 text-border-subtle mb-4" />
      <h3 className="text-sm font-semibold text-text-primary mb-1">
        No sermons yet
      </h3>
      <p className="text-xs text-text-muted mb-5">
        Create your first sermon to get started
      </p>
      <Button variant="primary" size="sm" asChild>
        <Link href="/sermon/new">
          <Plus className="h-3.5 w-3.5" />
          New Sermon
        </Link>
      </Button>
    </div>
  );
}
