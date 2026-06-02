"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sermon", label: "Sermons", icon: BookOpen },
  { href: "/study", label: "Study", icon: Search },
  { href: "/rhema", label: "Rhema", icon: RhemaIcon },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--accent)" }}
        />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.displayName ?? user.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Sidebar */}
      <aside
        className="w-[240px] shrink-0 flex flex-col m-3 mr-0 rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 flex items-center justify-center rounded-xl shrink-0"
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
            <div className="min-w-0">
              <p
                className="text-sm font-bold tracking-tight leading-tight truncate"
                style={{ color: "var(--text-primary)" }}
              >
                Preparing Disciples
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Sermon workspace
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150"
                )}
                style={
                  active
                    ? {
                        backgroundColor: "rgba(184,144,63,0.10)",
                        color: "var(--accent)",
                      }
                    : {
                        color: "var(--text-muted)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--bg-elevated)";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--text-muted)";
                  }
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {active && (
                  <div
                    className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 pb-3">
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 group cursor-default"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <div
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: "rgba(184,144,63,0.15)",
                color: "var(--accent)",
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {displayName}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {user.email}
              </p>
            </div>
            <button
              onClick={() => signOut().then(() => router.replace("/"))}
              className="p-1.5 rounded-lg transition-colors shrink-0"
              title="Sign out"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--danger)";
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "rgba(192,57,43,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-muted)";
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0 p-3 pl-3">
        {children}
      </main>
    </div>
  );
}

function RhemaIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-serif leading-none select-none inline-block", className)}
      style={{ fontSize: "0.9em" }}
    >
      Ρ
    </span>
  );
}
