import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function getFirebaseConfigOrNull() {
  const {
    NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID,
  } = process.env;

  const missing: string[] = [];
  if (!NEXT_PUBLIC_FIREBASE_API_KEY) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!NEXT_PUBLIC_FIREBASE_PROJECT_ID) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)
    missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!NEXT_PUBLIC_FIREBASE_APP_ID) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

  if (missing.length) {
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
    // Don't crash during build/prerender. We'll error only if a client feature actually uses Firebase.
    // Provide a specific missing list to make Vercel config issues obvious.
    const {
      NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID,
    } = process.env;
    const missing: string[] = [];
    if (!NEXT_PUBLIC_FIREBASE_API_KEY) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
    if (!NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    if (!NEXT_PUBLIC_FIREBASE_PROJECT_ID) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    if (!NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    if (!NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)
      missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
    if (!NEXT_PUBLIC_FIREBASE_APP_ID) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

    throw new Error(
      `Missing Firebase client env vars: ${missing.length ? missing.join(", ") : "(unknown)"}`,
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

