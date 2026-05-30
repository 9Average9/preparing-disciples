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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Sermons</h1>
          <p className="text-sm text-text-muted">
            {sermons.length} sermon{sermons.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="primary" size="md" asChild>
          <Link href="/sermon/new">
            <Plus className="h-4 w-4" />
            New Sermon
          </Link>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-40 bg-bg-surface border border-border-subtle animate-pulse"
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
    <div className="bg-bg-surface border border-border-subtle hover:border-[#3a4052] transition-colors duration-150 group flex flex-col">
      <button
        onClick={onOpen}
        className="flex-1 text-left p-5 flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <BookOpen className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
          <Badge
            variant={sermon.status === "complete" ? "complete" : "draft"}
          >
            {sermon.status}
          </Badge>
        </div>
        <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors leading-snug">
          {sermon.title}
        </h3>
        {sermon.outline.scriptureRef && (
          <p className="text-xs text-text-muted">{sermon.outline.scriptureRef}</p>
        )}
        {sermon.outline.theme && (
          <p className="text-xs text-text-muted italic truncate">
            {sermon.outline.theme}
          </p>
        )}
      </button>

      <div className="border-t border-border-subtle px-5 py-3 flex items-center justify-between bg-bg-elevated/30">
        <span className="text-xs text-text-muted">
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
        <button className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="w-44 bg-bg-elevated border border-border-subtle shadow-xl py-1 z-50"
          sideOffset={4}
        >
          <DropdownMenu.Item
            onSelect={onOpen}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface cursor-pointer outline-none"
          >
            <ExternalLink className="h-3.5 w-3.5 text-text-muted" />
            Open Sermon
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border-subtle" />
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/5 cursor-pointer outline-none"
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
    <div className="border border-dashed border-border-subtle bg-bg-surface/50 p-16 flex flex-col items-center text-center">
      <BookOpen className="h-10 w-10 text-border-subtle mb-4" />
      <h3 className="text-base font-semibold text-text-primary mb-2">
        No sermons yet
      </h3>
      <p className="text-sm text-text-muted mb-6 max-w-xs">
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
