import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]) {
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );

  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return jsonError("Missing Authorization Bearer token.", 401);

  let caller: any;
  try {
    caller = await adminAuth.verifyIdToken(token);
  } catch {
    return jsonError("Invalid auth token.", 401);
  }
  if (caller?.role !== "admin") return jsonError("Admin only.", 403);

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind"); // "all-bids" | "winners"

  if (kind !== "all-bids" && kind !== "winners") {
    return jsonError('Invalid kind. Use "all-bids" or "winners".');
  }

  // Note: For large datasets you'd paginate. For this event size, read-all is OK.
  let q = adminDb.collection("bids") as FirebaseFirestore.Query;
  if (kind === "winners") q = q.where("isWinner", "==", true);

  const snap = await q.get();
  const rows = snap.docs.map((d) => {
    const b = d.data() as any;
    return {
      bidId: d.id,
      itemId: b.itemId ?? "",
      bidderId: b.bidderId ?? "",
      bidderName: b.bidderName ?? "",
      bidderEmail: b.bidderEmail ?? "",
      bidderPhone: b.bidderPhone ?? "",
      amount: b.amount ?? "",
      timestamp: b.timestamp?.toDate ? b.timestamp.toDate().toISOString() : "",
      isWinner: Boolean(b.isWinner),
      winnerEmailSent: Boolean(b.winnerEmailSent),
      winnerEmailSentAt: b.winnerEmailSentAt?.toDate ? b.winnerEmailSentAt.toDate().toISOString() : "",
    };
  });

  const csv = toCsv(rows);
  const filename = kind === "winners" ? "winners.csv" : "all-bids.csv";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

