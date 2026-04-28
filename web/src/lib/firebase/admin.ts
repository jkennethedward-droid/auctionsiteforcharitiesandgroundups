import "server-only";
import admin from "firebase-admin";
import { mustGetEnv } from "@/lib/env";

function getServiceAccount() {
  const json = mustGetEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
  return JSON.parse(json);
}

export function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const serviceAccount = getServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminApp = getAdminApp();
export const adminAuth = adminApp.auth();
export const adminDb = adminApp.firestore();
export const adminStorage = adminApp.storage();

