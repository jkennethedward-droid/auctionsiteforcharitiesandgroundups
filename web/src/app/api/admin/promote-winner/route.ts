import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { sendResendEmail } from "@/lib/resend";

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

function winnerHtml(args: {
  eventTitle: string;
  name: string;
  itemTitle: string;
  amount: number;
  orgName: string;
}) {
  const { eventTitle, name, itemTitle, amount, orgName } = args;
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
      <div style="background:#F97316;color:#fff;padding:16px 20px;font-weight:700">
        ${eventTitle}
      </div>
      <div style="padding:20px">
        <p>Hi ${name},</p>
        <p>Congratulations! You are the winning bidder for <b>${itemTitle}</b> with a bid of <b>$${amount}</b>.</p>
        <p>Our team will be in touch shortly to arrange collection. Thank you for your support!</p>
        <p style="color:#57534E;margin-top:24px">${orgName}</p>
      </div>
    </div>
  `;
}

async function logFailedEmail(args: {
  recipient: string;
  itemId: string;
  itemTitle: string;
  errorMessage: string;
}) {
  const adminDb = getAdminDb();
  await adminDb.doc(`logs/failedEmails`).collection("entries").add({
    recipient: args.recipient,
    type: "winner",
    itemId: args.itemId,
    itemTitle: args.itemTitle,
    timestamp: new Date(),
    errorMessage: args.errorMessage,
  });
}

type Body = { itemId: string };

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

  const itemId = String(body.itemId || "").trim();
  if (!itemId) return jsonError("Missing itemId.");

  // Find current winner (if any) and the next highest bid.
  const bidsSnap = await adminDb
    .collection("bids")
    .where("itemId", "==", itemId)
    .orderBy("amount", "desc")
    .orderBy("timestamp", "desc")
    .limit(10)
    .get();

  if (bidsSnap.empty) return jsonError("No bids for this item.", 400);

  const bids = bidsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const currentWinner = bids.find((b) => b.isWinner === true) ?? null;

  // Choose new winner:
  // - If there is a current winner, promote the next bid after it in the sorted list.
  // - If there isn't, promote the top bid.
  let nextWinner: any | null = null;
  if (!currentWinner) {
    nextWinner = bids[0];
  } else {
    const idx = bids.findIndex((b) => b.id === currentWinner.id);
    nextWinner = idx >= 0 ? bids[idx + 1] ?? null : null;
  }

  if (!nextWinner) return jsonError("No next highest bid to promote.", 400);

  const itemSnap = await adminDb.doc(`items/${itemId}`).get();
  const itemTitle = itemSnap.exists ? String((itemSnap.data() as any)?.title || "Item") : "Item";

  const siteSnap = await adminDb.doc("config/site").get();
  const site = siteSnap.exists ? (siteSnap.data() as any) : {};
  const eventTitle = String(site.eventTitle || "Silent Auction");
  const orgName = String(site.orgName || "");

  // Update winner flags.
  if (currentWinner) {
    await adminDb.doc(`bids/${currentWinner.id}`).set({ isWinner: false }, { merge: true });
  }
  await adminDb.doc(`bids/${nextWinner.id}`).set({ isWinner: true }, { merge: true });

  // Email the promoted winner.
  const winnerEmail = String(nextWinner.bidderEmail || "");
  const winnerName = String(nextWinner.bidderName || "there");
  const amount = Number(nextWinner.amount || 0);

  if (winnerEmail) {
    try {
      await sendResendEmail({
        to: winnerEmail,
        subject: `You won ${itemTitle}!`,
        html: winnerHtml({ eventTitle, name: winnerName, itemTitle, amount, orgName }),
      });

      await adminDb.doc(`bids/${nextWinner.id}`).set(
        { winnerEmailSent: true, winnerEmailSentAt: new Date() },
        { merge: true },
      );
    } catch (e: any) {
      await logFailedEmail({
        recipient: winnerEmail,
        itemId,
        itemTitle,
        errorMessage: e?.message ?? String(e),
      });
    }
  }

  // Update public winners list in config/auction (best-effort).
  const auctionRef = adminDb.doc("config/auction");
  const auctionSnap = await auctionRef.get();
  if (auctionSnap.exists) {
    const a = auctionSnap.data() as any;
    const winners = Array.isArray(a.winners) ? [...a.winners] : [];
    const entryIdx = winners.findIndex((w: any) => w.itemId === itemId);
    const oldAmount = entryIdx >= 0 ? Number(winners[entryIdx]?.amount || 0) : 0;
    const newEntry = { itemId, itemTitle, winnerName, amount };
    if (entryIdx >= 0) winners[entryIdx] = newEntry;
    else winners.push(newEntry);

    const totalRaised = Number(a.totalRaised || 0) - oldAmount + amount;

    await auctionRef.set({ winners, totalRaised, winnersPublished: true }, { merge: true });
  }

  // Log admin action
  await adminDb.doc("logs/winnerActions").collection("entries").add({
    itemId,
    itemTitle,
    fromBidId: currentWinner?.id ?? null,
    toBidId: nextWinner.id,
    timestamp: new Date(),
  });

  return NextResponse.json({
    ok: true,
    itemId,
    winnerBidId: nextWinner.id,
    winnerName,
    amount,
  });
}

