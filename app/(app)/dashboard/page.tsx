"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, Search, ArrowRight, Sparkles } from "lucide-react";
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
    hour < 5
      ? "Good night"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  const firstName =
    user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Pastor";

  return (
    <div
      className="h-full overflow-y-auto rounded-2xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Hero greeting */}
      <div
        className="px-8 pt-8 pb-7 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-end justify-between gap-4 max-w-4xl">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-widest mb-2"
              style={{ color: "var(--accent)" }}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1
              className="text-3xl font-bold tracking-tight mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Ready to prepare? Your tools are waiting.
            </p>
          </div>
          <div
            className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold hidden sm:flex"
            style={{
              backgroundColor: "rgba(184,144,63,0.10)",
              color: "var(--accent)",
              border: "1.5px solid rgba(184,144,63,0.18)",
            }}
          >
            {firstName[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="px-8 py-8 max-w-4xl space-y-10">
        {/* Quick actions */}
        <section>
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <QuickAction
              href="/sermon/new"
              icon={<Plus className="h-5 w-5" />}
              label="New Sermon"
              description="Start a fresh outline"
              primary
            />
            <QuickAction
              href="/rhema"
              icon={<span className="font-serif text-xl leading-none">Ρ</span>}
              label="Open Rhema"
              description="Greek text & lexicon"
            />
            <QuickAction
              href="/study"
              icon={<Search className="h-5 w-5" />}
              label="Study Passage"
              description="Search & take notes"
            />
          </div>
        </section>

        {/* Recent sermons */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Recent Sermons</SectionLabel>
            <Link
              href="/sermon"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: "var(--accent)" }}
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
                  className="h-36 rounded-2xl animate-pulse"
                  style={{ backgroundColor: "var(--bg-elevated)" }}
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

        {/* Tip strip */}
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-2xl"
          style={{
            backgroundColor: "rgba(184,144,63,0.06)",
            border: "1px solid rgba(184,144,63,0.14)",
          }}
        >
          <Sparkles
            className="h-4 w-4 mt-0.5 shrink-0"
            style={{ color: "var(--accent)" }}
          />
          <div>
            <p
              className="text-sm font-semibold mb-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              Tip: Use Rhema to deepen your text study
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Browse Greek words, check the LXX, and look up cross-references —
              then bring your notes straight into your sermon outline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-4"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </p>
  );
}

function QuickAction({
  href,
  icon,
  label,
  description,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={
        primary
          ? {
              background:
                "linear-gradient(135deg, rgba(184,144,63,0.10) 0%, rgba(201,168,76,0.06) 100%)",
              border: "1.5px solid rgba(184,144,63,0.22)",
              boxShadow: "var(--shadow-card)",
            }
          : {
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
            }
      }
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center"
        style={
          primary
            ? {
                backgroundColor: "rgba(184,144,63,0.15)",
                color: "var(--accent)",
              }
            : {
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }
        }
      >
        {icon}
      </div>
      <div>
        <p
          className="text-sm font-semibold mb-0.5 transition-colors"
          style={{ color: primary ? "var(--accent)" : "var(--text-primary)" }}
        >
          {label}
        </p>
        <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
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
      className="group text-left flex flex-col p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "var(--shadow-card-hover)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "rgba(184,144,63,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "var(--border-subtle)";
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <BookOpen
            className="h-3.5 w-3.5"
            style={{ color: "var(--text-muted)" }}
          />
        </div>
        <Badge variant={sermon.status === "complete" ? "complete" : "draft"}>
          {sermon.status}
        </Badge>
      </div>
      <h3
        className="text-sm font-semibold mb-1 line-clamp-2 flex-1 transition-colors"
        style={{ color: "var(--text-primary)" }}
      >
        {sermon.title}
      </h3>
      {sermon.outline.scriptureRef && (
        <p className="text-xs mb-2" style={{ color: "var(--accent)", opacity: 0.8 }}>
          {sermon.outline.scriptureRef}
        </p>
      )}
      <p className="text-xs mt-auto" style={{ color: "var(--text-muted)" }}>
        {formatDate(sermon.updatedAt)}
      </p>
    </button>
  );
}

function EmptySermons() {
  return (
    <div
      className="flex flex-col items-center text-center px-10 py-14 rounded-2xl"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1.5px dashed var(--border-subtle)",
      }}
    >
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
        style={{
          backgroundColor: "rgba(184,144,63,0.08)",
          border: "1px solid rgba(184,144,63,0.15)",
        }}
      >
        <BookOpen className="h-6 w-6" style={{ color: "var(--accent)" }} />
      </div>
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        No sermons yet
      </h3>
      <p className="text-xs leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
        Create your first sermon to get started with your preparation journey.
      </p>
      <Button variant="primary" size="sm" asChild>
        <Link href="/sermon/new">
          <Plus className="h-3.5 w-3.5" />
          Create First Sermon
        </Link>
      </Button>
    </div>
  );
}
