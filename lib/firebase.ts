import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "placeholder",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "placeholder",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "placeholder",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "placeholder",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "placeholder",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "placeholder",
};

let _app: FirebaseApp;
let _auth: Auth;
let _db: Firestore;

function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getFirebaseApp());
  }
  return _db;
}

// Convenience exports for compatibility
export const app = getFirebaseApp();
export const auth = getFirebaseAuth();
export const db = getFirebaseDb();
