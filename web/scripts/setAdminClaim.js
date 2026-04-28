/**
 * One-time script to set Firebase Auth custom claim for Admin users.
 *
 * Usage (PowerShell):
 *   cd web
 *   node scripts/setAdminClaim.js <FIREBASE_UID>
 *
 * Required env:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  (full service account JSON, stringified)
 */

const admin = require("firebase-admin");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Put it in web/.env.local (one line JSON string).`
    );
  }
  return v;
}

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    throw new Error("Usage: node scripts/setAdminClaim.js <FIREBASE_UID>");
  }

  const serviceAccountJson = requireEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
  const serviceAccount = JSON.parse(serviceAccountJson);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  await admin.auth().setCustomUserClaims(uid, { role: "admin" });
  const user = await admin.auth().getUser(uid);

  console.log("✅ Admin claim set.");
  console.log("uid:", user.uid);
  console.log("email:", user.email);
  console.log("customClaims:", user.customClaims || {});
  console.log(
    "Note: user may need to sign out/in to refresh token and receive new claims."
  );
}

main().catch((err) => {
  console.error("❌ Failed to set admin claim.");
  console.error(err);
  process.exitCode = 1;
});

