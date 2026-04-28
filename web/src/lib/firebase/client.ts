import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase "web app config" values are public identifiers (not secrets).
// We still prefer env vars, but provide a safe fallback so the app can run
// even if hosting env injection is misconfigured.
const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCYJAJISHAuT7xoxNnPctIY5dYDvzVYhgE",
  authDomain: "auction-site-26.firebaseapp.com",
  projectId: "auction-site-26",
  storageBucket: "auction-site-26.firebasestorage.app",
  messagingSenderId: "148389564320",
  appId: "1:148389564320:web:e4353159a7cacc41ed5ec5",
} as const;

function getFirebaseConfigOrNull() {
  const {
    NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID,
  } = process.env;

  // If ANY of the required vars are missing, fall back to the known public config.
  // This avoids hard-crashing the site in production.
  if (
    !NEXT_PUBLIC_FIREBASE_API_KEY ||
    !NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    !NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    !NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    !NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    !NEXT_PUBLIC_FIREBASE_APP_ID
  ) {
    return FALLBACK_FIREBASE_CONFIG;
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
    // Should be impossible now that getFirebaseConfigOrNull falls back, but keep a clear error.
    throw new Error("Firebase client config unavailable.");
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

