import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { closeAuctionAndPublishWinners } from "@/lib/closeAuction";

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

export async function POST(req: Request) {
  let adminAuth: ReturnType<typeof getAdminAuth>;
  try {
    adminAuth = getAdminAuth();
  } catch (e: any) {
    return jsonError(
      e?.message ||
        "Server is missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel (Production + Preview) and redeploy.",
      500,
    );
  }
  const token = getBearerToken(req);
  if (!token) return jsonError("Missing Authorization Bearer token.", 401);

  let caller: any;
  try {
    caller = await adminAuth.verifyIdToken(token);
  } catch {
    return jsonError("Invalid auth token.", 401);
  }

  if (caller?.role !== "admin") return jsonError("Admin only.", 403);

  try {
    const { winnersCount, totalRaised } = await closeAuctionAndPublishWinners();
    return NextResponse.json({ ok: true, winnersCount, totalRaised });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to close auction.", 400);
  }

}

