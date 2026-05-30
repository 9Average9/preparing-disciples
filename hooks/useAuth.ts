"use client";

import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string): Promise<FirebaseUser> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<FirebaseUser> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    return cred.user;
  }

  async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  return { user, loading, signIn, signUp, signOut };
}
