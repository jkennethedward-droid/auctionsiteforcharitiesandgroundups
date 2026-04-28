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

function parseBool(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function parseNumber(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

// Minimal CSV parser (RFC4180-ish) supporting quotes and commas.
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    // ignore trailing blank row
    const allBlank = row.every((c) => !String(c ?? "").trim());
    if (!allBlank) rows.push(row);
    row = [];
  }

  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }
    field += ch;
  }
  pushField();
  pushRow();

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => String(h ?? "").trim());
  return { headers, rows: rows.slice(1) };
}

type Body = { csv?: string };

export async function POST(req: Request) {
  let adminAuth: ReturnType<typeof getAdminAuth>;
  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminAuth = getAdminAuth();
    adminDb = getAdminDb();
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

  const csv = String(body.csv ?? "").trim();
  if (!csv) return jsonError("Missing csv.");

  const parsed = parseCsv(csv);
  if (!parsed.headers.length) return jsonError("CSV missing header row.");

  const headerIndex = new Map<string, number>();
  parsed.headers.forEach((h, i) => headerIndex.set(h.trim().toLowerCase(), i));

  function getCell(cols: string[], name: string): string {
    const idx = headerIndex.get(name.toLowerCase());
    if (idx == null) return "";
    return String(cols[idx] ?? "");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const batch = adminDb.batch();
  let ops = 0;

  for (let i = 0; i < parsed.rows.length; i++) {
    const cols = parsed.rows[i];
    const title = getCell(cols, "title").trim();
    if (!title) {
      skipped++;
      continue;
    }

    const idRaw = getCell(cols, "id").trim();
    const startingBid = parseNumber(getCell(cols, "startingBid")) ?? 50;
    const isFeatured = parseBool(getCell(cols, "isFeatured"));
    const description = getCell(cols, "description").trim();
    const photoUrlsCell = getCell(cols, "photoUrls").trim();
    const photoUrls = photoUrlsCell
      ? photoUrlsCell
          .split(";")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const ref = idRaw ? adminDb.doc(`items/${idRaw}`) : adminDb.collection("items").doc();
    const exists = idRaw ? await ref.get().then((s) => s.exists).catch(() => false) : false;

    const payload: Record<string, unknown> = {
      title,
      description,
      photoUrls,
      startingBid,
      currentHighestBid: startingBid,
      currentHighestBidderId: "",
      uploaderName: "Admin",
      uploaderUid: String(caller?.uid || "admin"),
      isFeatured,
      createdAt: new Date(),
    };

    batch.set(ref, payload, { merge: true });
    ops++;
    if (exists) updated++;
    else created++;

    // Firestore batches are limited to 500 operations.
    if (ops >= 450) {
      await batch.commit();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  return NextResponse.json({ ok: true, created, updated, skipped });
}

