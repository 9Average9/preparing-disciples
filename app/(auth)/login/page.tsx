"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { signIn } = useAuthContext();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in.";
      setError(friendlyError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div
              className="h-10 w-10 flex items-center justify-center rounded-xl"
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
          </Link>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sign in to your account to continue
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 flex flex-col gap-5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <div
                className="px-3.5 py-2.5 rounded-xl text-sm"
                style={{
                  color: "var(--danger)",
                  backgroundColor: "rgba(192,57,43,0.06)",
                  border: "1px solid rgba(192,57,43,0.18)",
                }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-1"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-sm mt-5" style={{ color: "var(--text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}

function friendlyError(message: string): string {
  if (message.includes("user-not-found") || message.includes("wrong-password"))
    return "Invalid email or password.";
  if (message.includes("too-many-requests"))
    return "Too many attempts. Please try again later.";
  if (message.includes("user-disabled")) return "This account has been disabled.";
  return "Something went wrong. Please try again.";
}
