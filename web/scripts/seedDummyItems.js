/**
 * Seed ~10 dummy items into Firestore for testing.
 *
 * Usage (PowerShell):
 *   cd web
 *   node scripts/seedDummyItems.js
 *   node scripts/seedDummyItems.js 15   # optional count
 *
 * Required env:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  (full service account JSON, stringified)
 */

const admin = require("firebase-admin");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Put it in web/.env.local (one line JSON string).`);
  return v;
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(requireEnv("FIREBASE_SERVICE_ACCOUNT_KEY"));
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function makeTitle(i) {
  const titles = [
    "Bubble Tea Bundle (10 cups)",
    "Spa & Wellness Voucher",
    "Artisan Gourmet Hamper",
    "Fine Dining Dinner for Two",
    "Family Staycation Package",
    "Handmade Pottery Set",
    "Movie Night Pack",
    "Premium Coffee Sampler",
    "Fitness Class Pass (5 sessions)",
    "Weekend Brunch for Two",
  ];
  return titles[(i - 1) % titles.length];
}

async function main() {
  const count = Math.max(1, Math.min(50, Number(process.argv[2] || 10)));
  initAdmin();
  const db = admin.firestore();

  const batch = db.batch();
  for (let i = 1; i <= count; i++) {
    const id = `seed_${String(i).padStart(2, "0")}`;
    const title = makeTitle(i);
    const startingBid = 20 + i * 10;

    batch.set(
      db.doc(`items/${id}`),
      {
        title,
        description:
          "Test item seeded for staging. Replace with real description and photos before launch.",
        photoUrls: [],
        startingBid,
        currentHighestBid: startingBid,
        currentHighestBidderId: "",
        uploaderName: "Seed",
        uploaderUid: "seed",
        isFeatured: i <= 4,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();
  console.log(`✅ Seeded/updated ${count} items under items/seed_XX`);
  console.log("Tip: mark auction status 'pre-launch' to preview catalog without prices.");
}

main().catch((err) => {
  console.error("❌ Failed to seed dummy items.");
  console.error(err);
  process.exitCode = 1;
});

