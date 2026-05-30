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
  ChevronRight,
} from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sermon", label: "Sermons", icon: BookOpen },
  { href: "/study", label: "Study", icon: Search },
  {
    href: "/rhema",
    label: "Rhema",
    icon: RhemaIcon,
  },
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
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-subtle border-t-accent" />
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
    <div className="flex h-screen bg-bg-base overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-bg-surface border-r border-border-subtle">
        {/* Wordmark */}
        <div className="px-5 py-5 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 flex items-center justify-center bg-accent/10 border border-accent/30 shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                stroke="#c9a84c"
                strokeWidth="1.5"
              >
                <path d="M12 3v18M7 8h10" strokeLinecap="round" />
                <path d="M5 14h6v5H5z" strokeLinecap="square" />
                <path d="M13 14h6v5h-6z" strokeLinecap="square" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-text-primary leading-tight">
              Preparing
              <br />
              Disciples
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors duration-100 group",
                  active
                    ? "bg-bg-elevated text-text-primary border-l-2 border-accent pl-[10px]"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 border-l-2 border-transparent pl-[10px]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {active && (
                  <ChevronRight className="ml-auto h-3 w-3 text-accent opacity-60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center gap-3 px-2 py-2 group">
            <div className="h-7 w-7 shrink-0 bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-semibold text-accent">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {displayName}
              </p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut().then(() => router.replace("/"))}
              className="p-1 text-text-muted hover:text-danger transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
    </div>
  );
}

function RhemaIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-serif leading-none select-none inline-block",
        className
      )}
      style={{ fontSize: "0.9em" }}
    >
      Ρ
    </span>
  );
}
