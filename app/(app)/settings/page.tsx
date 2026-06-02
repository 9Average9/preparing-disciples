"use client";

import { useTheme, THEMES, type Theme } from "@/components/ThemeProvider";
import { useAuthContext } from "@/components/AuthProvider";
import { Check, Palette, User, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthContext();

  const displayName = user?.displayName ?? user?.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="h-full overflow-y-auto rounded-2xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-2xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1
            className="text-2xl font-bold mb-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            Settings
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Personalize your workspace and account preferences.
          </p>
        </div>

        {/* ── Theme ── */}
        <section className="mb-10">
          <SectionHeader icon={<Palette className="h-4 w-4" />} title="Appearance" />
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Choose a theme that fits your study style.
          </p>

          <div className="grid grid-cols-5 gap-3">
            {THEMES.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                active={theme === t.id}
                onSelect={() => setTheme(t.id as Theme)}
              />
            ))}
          </div>
        </section>

        <Divider />

        {/* ── Account ── */}
        <section className="mb-10 mt-8">
          <SectionHeader icon={<User className="h-4 w-4" />} title="Account" />

          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: "var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {/* Avatar + name row */}
            <div
              className="flex items-center gap-4 px-5 py-5"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <div
                className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center text-xl font-bold"
                style={{
                  backgroundColor: "rgba(184,144,63,0.12)",
                  color: "var(--accent)",
                  border: "1.5px solid rgba(184,144,63,0.2)",
                }}
              >
                {initials}
              </div>
              <div>
                <p
                  className="text-base font-semibold mb-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {displayName}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {user?.email}
                </p>
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: "var(--border-subtle)" }} />

            <div
              className="px-5 py-4"
              style={{ backgroundColor: "var(--bg-elevated)" }}
            >
              <InfoRow label="Display name" value={user?.displayName ?? "—"} />
              <InfoRow label="Email" value={user?.email ?? "—"} />
              <InfoRow label="Member since" value={user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"} last />
            </div>
          </div>
        </section>

        <Divider />

        {/* ── About ── */}
        <section className="mt-8">
          <SectionHeader icon={<Info className="h-4 w-4" />} title="About" />
          <div
            className="rounded-2xl border px-5 py-4 space-y-2"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-elevated)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <InfoRow label="App" value="Preparing Disciples" />
            <InfoRow label="Purpose" value="Sermon preparation workspace" />
            <InfoRow label="Tools" value="Rhema · Sermon Workshop · Slide Builder" last />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <h2
        className="text-sm font-semibold tracking-wide"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="h-px w-full"
      style={{ backgroundColor: "var(--border-subtle)" }}
    />
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2", !last && "border-b border-border-subtle")}>
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function ThemeCard({
  theme,
  active,
  onSelect,
}: {
  theme: (typeof THEMES)[0];
  active: boolean;
  onSelect: () => void;
}) {
  const textColor = theme.light ? "#1a1612" : "#ffffff";
  const mutedColor = theme.light ? "#8a8078" : "#7880a0";

  return (
    <button
      onClick={onSelect}
      className="group relative flex flex-col gap-2.5 p-3 rounded-2xl transition-all duration-200 text-left"
      style={{
        backgroundColor: theme.preview.base,
        border: active
          ? `2px solid ${theme.preview.accent}`
          : `2px solid ${theme.preview.border}`,
        boxShadow: active
          ? `0 0 0 3px ${theme.preview.accent}22, var(--shadow-card)`
          : "var(--shadow-card)",
        transform: active ? "translateY(-1px)" : "none",
      }}
      title={theme.name}
    >
      {/* Mini UI preview */}
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{
          backgroundColor: theme.preview.surface,
          border: `1px solid ${theme.preview.border}`,
          height: 48,
          display: "flex",
          flexDirection: "column",
          padding: "5px",
          gap: 3,
        }}
      >
        {/* Fake nav bar */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          <div
            style={{
              width: 18,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.preview.accent,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              width: 12,
              height: 4,
              borderRadius: 2,
              backgroundColor: mutedColor,
              opacity: 0.3,
            }}
          />
          <div
            style={{
              width: 10,
              height: 4,
              borderRadius: 2,
              backgroundColor: mutedColor,
              opacity: 0.2,
            }}
          />
        </div>
        {/* Fake content */}
        <div style={{ display: "flex", gap: 3, flex: 1 }}>
          <div
            style={{
              width: 20,
              borderRadius: 4,
              backgroundColor: theme.preview.base,
              border: `1px solid ${theme.preview.border}`,
            }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, justifyContent: "center" }}>
            <div
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: mutedColor,
                opacity: 0.4,
                width: "80%",
              }}
            />
            <div
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: mutedColor,
                opacity: 0.25,
                width: "55%",
              }}
            />
          </div>
        </div>
      </div>

      {/* Name */}
      <p className="text-xs font-semibold leading-none" style={{ color: textColor }}>
        {theme.name}
      </p>

      {/* Active indicator */}
      {active && (
        <div
          className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: theme.preview.accent }}
        >
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
