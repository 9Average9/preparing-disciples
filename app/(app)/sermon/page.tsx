"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  BookOpen,
  MoreHorizontal,
  Trash2,
  ExternalLink,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuthContext } from "@/components/AuthProvider";
import { getUserSermons, deleteSermon } from "@/lib/sermons";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Sermon } from "@/types";

export default function SermonListPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserSermons(user.uid)
      .then(setSermons)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this sermon? This cannot be undone.")) return;
    await deleteSermon(id);
    setSermons((prev) => prev.filter((s) => s.id !== id));
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
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-6 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <h1
            className="text-2xl font-bold mb-0.5"
            style={{ color: "var(--text-primary)" }}
          >
            Sermons
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {sermons.length} sermon{sermons.length !== 1 ? "s" : ""} in your library
          </p>
        </div>
        <Button variant="primary" size="md" asChild>
          <Link href="/sermon/new">
            <Plus className="h-4 w-4" />
            New Sermon
          </Link>
        </Button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl animate-pulse"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              />
            ))}
          </div>
        ) : sermons.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {sermons.map((sermon) => (
              <SermonCard
                key={sermon.id}
                sermon={sermon}
                onOpen={() => router.push(`/sermon/${sermon.id}`)}
                onDelete={() => handleDelete(sermon.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SermonCard({
  sermon,
  onOpen,
  onDelete,
}: {
  sermon: Sermon;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "var(--shadow-card-hover)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "rgba(184,144,63,0.28)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "var(--border-subtle)";
      }}
    >
      <button
        onClick={onOpen}
        className="flex-1 text-left p-5 flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
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
          className="text-sm font-semibold leading-snug transition-colors"
          style={{ color: "var(--text-primary)" }}
        >
          {sermon.title}
        </h3>
        {sermon.outline.scriptureRef && (
          <p className="text-xs" style={{ color: "var(--accent)", opacity: 0.8 }}>
            {sermon.outline.scriptureRef}
          </p>
        )}
        {sermon.outline.theme && (
          <p
            className="text-xs italic truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {sermon.outline.theme}
          </p>
        )}
      </button>

      <div
        className="px-5 py-3 flex items-center justify-between border-t"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Updated {formatDate(sermon.updatedAt)}
        </span>
        <SermonMenu onOpen={onOpen} onDelete={onDelete} />
      </div>
    </div>
  );
}

function SermonMenu({
  onOpen,
  onDelete,
}: {
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "var(--bg-elevated)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="w-44 rounded-xl py-1.5 z-50"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-lg)",
          }}
          sideOffset={4}
        >
          <DropdownMenu.Item
            onSelect={onOpen}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer outline-none rounded-lg mx-1 transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            <ExternalLink
              className="h-3.5 w-3.5"
              style={{ color: "var(--text-muted)" }}
            />
            Open Sermon
          </DropdownMenu.Item>
          <div
            className="my-1 h-px mx-2"
            style={{ backgroundColor: "var(--border-subtle)" }}
          />
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer outline-none rounded-lg mx-1 transition-colors"
            style={{ color: "var(--danger)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "rgba(192,57,43,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center text-center px-10 py-16 rounded-2xl"
      style={{
        border: "1.5px dashed var(--border-subtle)",
        backgroundColor: "var(--bg-elevated)",
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
        className="text-base font-semibold mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        No sermons yet
      </h3>
      <p
        className="text-sm mb-6 max-w-xs leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        Create your first sermon outline to get started with the workshop.
      </p>
      <Button variant="primary" asChild>
        <Link href="/sermon/new">
          <Plus className="h-4 w-4" />
          New Sermon
        </Link>
      </Button>
    </div>
  );
}
