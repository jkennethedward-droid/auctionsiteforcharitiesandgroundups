import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function makeTitle(i: number) {
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

export async function POST(req: Request) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  const token = getBearerToken(req);
  if (!token) return jsonError("Missing Authorization Bearer token.", 401);

  let caller: any;
  try {
    caller = await adminAuth.verifyIdToken(token);
  } catch {
    return jsonError("Invalid auth token.", 401);
  }
  if (caller?.role !== "admin") return jsonError("Admin only.", 403);

  let count = 10;
  try {
    const body = (await req.json().catch(() => null)) as any;
    if (body?.count != null) count = Number(body.count);
  } catch {
    // ignore
  }
  if (!Number.isFinite(count)) count = 10;
  count = Math.max(1, Math.min(50, Math.floor(count)));

  const batch = adminDb.batch();
  for (let i = 1; i <= count; i++) {
    const id = `seed_${String(i).padStart(2, "0")}`;
    const title = makeTitle(i);
    const startingBid = 20 + i * 10;

    batch.set(
      adminDb.doc(`items/${id}`),
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
        createdAt: new Date(),
      },
      { merge: true },
    );
  }

  await batch.commit();

  return NextResponse.json({ ok: true, count });
}

