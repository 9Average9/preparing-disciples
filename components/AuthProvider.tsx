"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { User as FirebaseUser } from "firebase/auth";

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within <AuthProvider>");
  }
  return ctx;
}
