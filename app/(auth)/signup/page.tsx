"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const { signUp } = useAuthContext();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create account.";
      setError(friendlyError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-8 w-8 flex items-center justify-center bg-accent/10 border border-accent/30">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="#c9a84c"
                strokeWidth="1.5"
              >
                <path d="M12 3v18M7 8h10" strokeLinecap="round" />
                <path d="M5 14h6v5H5z" strokeLinecap="square" />
                <path d="M13 14h6v5h-6z" strokeLinecap="square" />
              </svg>
            </div>
            <span className="text-base font-semibold text-text-primary">
              Preparing Disciples
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Create your account
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Start preparing sermons with confidence
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-bg-surface border border-border-subtle p-8 flex flex-col gap-5"
        >
          <Input
            label="Full name"
            type="text"
            placeholder="Pastor John Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
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
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            hint="Minimum 8 characters"
            required
          />

          {error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-1"
          >
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-5">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function friendlyError(message: string): string {
  if (message.includes("email-already-in-use"))
    return "An account with this email already exists.";
  if (message.includes("invalid-email")) return "Please enter a valid email address.";
  if (message.includes("weak-password"))
    return "Password is too weak. Please choose a stronger password.";
  return "Something went wrong. Please try again.";
}
