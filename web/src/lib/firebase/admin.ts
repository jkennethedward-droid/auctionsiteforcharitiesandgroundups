import "server-only";
import admin from "firebase-admin";
import { mustGetEnv } from "@/lib/env";

function getServiceAccount() {
  const json = mustGetEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
  return JSON.parse(json);
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

