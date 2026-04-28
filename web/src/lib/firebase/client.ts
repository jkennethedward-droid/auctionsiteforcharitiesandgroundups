import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function cleanEnv(value: string | undefined): string {
  const v = (value ?? "").trim();
  // Remove accidental wrapping quotes from copy/paste.
  const unwrapped =
    (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
      ? v.slice(1, -1)
      : v;
  // Remove stray leading/trailing quotes.
  return unwrapped.replace(/^["']+|["']+$/g, "").trim();
}

function getFirebaseConfigOrNull() {
  const NEXT_PUBLIC_FIREBASE_API_KEY = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const NEXT_PUBLIC_FIREBASE_PROJECT_ID = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = cleanEnv(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  );
  const NEXT_PUBLIC_FIREBASE_APP_ID = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (
    !NEXT_PUBLIC_FIREBASE_API_KEY ||
    !NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    !NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    !NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    !NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    !NEXT_PUBLIC_FIREBASE_APP_ID
  ) {
    return null;
  }

  return {
    apiKey: NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApp();
    return _app;
  }

  const cfg = getFirebaseConfigOrNull();
  if (!cfg) {
    throw new Error(
      "Missing Firebase client env vars (NEXT_PUBLIC_FIREBASE_*). Set them in Vercel (Production + Preview) and redeploy.",
    );
  }

  _app = initializeApp(cfg);
  return _app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirestoreDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

