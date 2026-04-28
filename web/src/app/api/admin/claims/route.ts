import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

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

type Body = {
  uid: string;
  role: "staff" | "none";
};

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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const uid = String(body.uid || "").trim();
  const role = body.role;
  if (!uid) return jsonError("Missing uid.");
  if (role !== "staff" && role !== "none") return jsonError("Invalid role.");

  const user = await adminAuth.getUser(uid).catch(() => null);
  if (!user) return jsonError("User not found.", 404);

  const existing = (user.customClaims || {}) as Record<string, unknown>;
  const nextClaims = { ...existing };

  if (role === "none") {
    delete (nextClaims as any).role;
  } else {
    (nextClaims as any).role = "staff";
  }

  await adminAuth.setCustomUserClaims(uid, nextClaims);

  return NextResponse.json({ ok: true, uid, role: role === "none" ? null : "staff" });
}

