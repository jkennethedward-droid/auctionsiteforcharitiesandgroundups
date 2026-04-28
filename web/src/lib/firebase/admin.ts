import "server-only";
import admin from "firebase-admin";
import { mustGetEnv } from "@/lib/env";

function getServiceAccount() {
  const json = mustGetEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
  try {
    return JSON.parse(json);
  } catch (e: any) {
    // Common failure: env value was pasted with extra wrapping quotes.
    // `mustGetEnv` already trims/dequotes, so if we still fail it's likely malformed JSON.
    const msg = e?.message ? ` (${e.message})` : "";
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON${msg}`);
  }
}

export function getAdminApp() {
  // IMPORTANT: don't initialize at import-time (Vercel build collects page data).
  if (admin.apps.length) return admin.app();

  const serviceAccount = getServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export function getAdminAuth() {
  return getAdminApp().auth();
}

export function getAdminDb() {
  return getAdminApp().firestore();
}

export function getAdminStorage() {
  return getAdminApp().storage();
}

