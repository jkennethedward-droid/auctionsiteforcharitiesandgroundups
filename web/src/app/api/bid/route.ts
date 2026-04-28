import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendResendEmail } from "@/lib/resend";

export const runtime = "nodejs";

type BidRequestBody = {
  itemId: string;
  amount: number;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function sgtTimestampNow() {
  // Firestore timestamps are absolute; we display them in SGT in UI.
  return new Date();
}

function bidConfirmationHtml(args: {
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
        <p>Your bid of <b>$${amount}</b> on <b>${itemTitle}</b> has been placed.</p>
        <p>You'll hear from us if you win. Good luck!</p>
        <p style="color:#57534E;margin-top:24px">${orgName}</p>
      </div>
    </div>
  `;
}

function outbidHtml(args: {
  eventTitle: string;
  name: string;
  itemTitle: string;
  amount: number;
  itemUrl: string;
  orgName: string;
}) {
  const { eventTitle, name, itemTitle, amount, itemUrl, orgName } = args;
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
      <div style="background:#F97316;color:#fff;padding:16px 20px;font-weight:700">
        ${eventTitle}
      </div>
      <div style="padding:20px">
        <p>Hi ${name},</p>
        <p>You've been outbid on <b>${itemTitle}</b>.</p>
        <p>The new highest bid is <b>$${amount}</b>.</p>
        <p><a href="${itemUrl}">View item</a></p>
        <p style="color:#57534E;margin-top:24px">${orgName}</p>
      </div>
    </div>
  `;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return jsonError("Missing Authorization Bearer token.", 401);

  let decoded: { uid: string; email?: string };
  try {
    decoded = (await adminAuth.verifyIdToken(token)) as any;
  } catch {
    return jsonError("Invalid auth token.", 401);
  }

  let body: BidRequestBody;
  try {
    body = (await req.json()) as BidRequestBody;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const itemId = String(body.itemId || "").trim();
  const amount = Number(body.amount);
  if (!itemId) return jsonError("Missing itemId.");
  if (!Number.isFinite(amount) || amount <= 0) return jsonError("Invalid amount.");

  const uid = decoded.uid;

  // Data we want to use after the transaction commits (emails).
  type EmailWork = {
    bidderEmail: string;
    bidderName: string;
    eventTitle: string;
    orgName: string;
    prevEmail?: string;
    prevName?: string;
    itemTitle: string;
    newHighest: number;
    prevUid?: string;
  };

  try {
    const now = sgtTimestampNow();
    const nowMs = now.getTime();

    const bidId = adminDb.collection("bids").doc().id;
    const bidRef = adminDb.doc(`bids/${bidId}`);
    const itemRef = adminDb.doc(`items/${itemId}`);
    const auctionRef = adminDb.doc("config/auction");
    const siteRef = adminDb.doc("config/site");
    const userRef = adminDb.doc(`users/${uid}`);
    const rateRef = adminDb.doc(`users/${uid}/rateLimits/item_${itemId}`);

    const emailWork = await adminDb.runTransaction<EmailWork>(async (tx) => {
      const [auctionSnap, itemSnap, userSnap, rateSnap, siteSnap] = await Promise.all([
        tx.get(auctionRef),
        tx.get(itemRef),
        tx.get(userRef),
        tx.get(rateRef),
        tx.get(siteRef),
      ]);

      const auction = auctionSnap.exists ? (auctionSnap.data() as any) : null;
      if (!auction || auction.status !== "open") {
        throw new Error("AUCTION_NOT_OPEN");
      }

      if (!itemSnap.exists) throw new Error("ITEM_NOT_FOUND");
      const item = itemSnap.data() as any;

      const userProfile = userSnap.exists ? (userSnap.data() as any) : null;
      const bidderEmail = String(userProfile?.email || decoded?.email || "").trim();
      const bidderName = String(userProfile?.name || "").trim();
      const bidderPhone = String(userProfile?.phone || "").trim();

      if (!bidderEmail || !bidderName || !bidderPhone) {
        throw new Error("PROFILE_INCOMPLETE");
      }

      const startingBid = Number(item.startingBid ?? 0);
      const currentHighestBid = Number(item.currentHighestBid ?? startingBid ?? 0);
      const prevUid = String(item.currentHighestBidderId || "").trim() || null;

      const min = currentHighestBid > 0 ? Math.max(startingBid, currentHighestBid + 5) : startingBid;
      if (amount < min) throw new Error("BID_TOO_LOW");

      // Rate limit: one bid per user per item per 30 seconds.
      const lastBidAtMs = rateSnap.exists ? Number((rateSnap.data() as any).lastBidAtMs ?? 0) : 0;
      if (lastBidAtMs && nowMs - lastBidAtMs < 30_000) throw new Error("RATE_LIMIT");

      // If you are already the highest bidder, we still allow raising your own bid.
      // (Optional; can change later.)

      // Create bid doc
      tx.set(bidRef, {
        itemId,
        bidderId: uid,
        bidderName,
        bidderEmail,
        bidderPhone,
        amount,
        timestamp: now,
        isWinner: false,
        winnerEmailSent: false,
        winnerEmailSentAt: null,
      });

      // Update item
      tx.update(itemRef, {
        currentHighestBid: amount,
        currentHighestBidderId: uid,
      });

      // Update rate limit doc
      tx.set(
        rateRef,
        {
          lastBidAtMs: nowMs,
        },
        { merge: true },
      );

      const itemTitle = String(item.title || "Item");

      // Write notification for previous highest bidder (if different user)
      let prevEmail: string | undefined;
      let prevName: string | undefined;
      if (prevUid && prevUid !== uid) {
        const prevUserSnap = await tx.get(adminDb.doc(`users/${prevUid}`));
        const prevProfile = prevUserSnap.exists ? (prevUserSnap.data() as any) : null;
        prevEmail = prevProfile?.email ? String(prevProfile.email) : undefined;
        prevName = prevProfile?.name ? String(prevProfile.name) : "there";

        const notifRef = adminDb
          .doc(`users/${prevUid}`)
          .collection("notifications")
          .doc();

        tx.set(notifRef, {
          itemId,
          itemTitle,
          newHighestBid: amount,
          read: false,
          createdAt: now,
        });
      }

      const site = siteSnap.exists ? (siteSnap.data() as any) : {};

      return {
        bidderEmail,
        bidderName,
        eventTitle: String(site?.eventTitle || "Silent Auction"),
        orgName: String(site?.orgName || ""),
        prevEmail,
        prevName,
        itemTitle,
        newHighest: amount,
        prevUid: prevUid ?? undefined,
      };
    });

    // Transaction committed. Send emails best-effort.
    {
      const eventTitle = emailWork.eventTitle;
      const orgName = emailWork.orgName;

      const itemUrl = `${process.env.NEXT_PUBLIC_APP_URL}/items/${itemId}`;

      async function logFailedEmail(args: {
        recipient: string;
        type: "confirmation" | "outbid" | "winner";
        errorMessage: string;
      }) {
        await adminDb.doc(`logs/failedEmails`).collection("entries").add({
          recipient: args.recipient,
          type: args.type,
          itemId,
          itemTitle: emailWork.itemTitle,
          timestamp: new Date(),
          errorMessage: args.errorMessage,
        });
      }

      // Confirmation email (bidder)
      try {
        await sendResendEmail({
          to: emailWork.bidderEmail,
          subject: `Your bid on ${emailWork.itemTitle} is confirmed`,
          html: bidConfirmationHtml({
            eventTitle,
            name: emailWork.bidderName,
            itemTitle: emailWork.itemTitle,
            amount,
            orgName,
          }),
        });
      } catch (e: any) {
        await logFailedEmail({
          recipient: emailWork.bidderEmail,
          type: "confirmation",
          errorMessage: e?.message ?? String(e),
        });
      }

      // Outbid email (previous highest)
      if (emailWork.prevEmail) {
        try {
          await sendResendEmail({
            to: emailWork.prevEmail,
            subject: `You've been outbid on ${emailWork.itemTitle}`,
            html: outbidHtml({
              eventTitle,
              name: emailWork.prevName || "there",
              itemTitle: emailWork.itemTitle,
              amount,
              itemUrl,
              orgName,
            }),
          });
        } catch (e: any) {
          await logFailedEmail({
            recipient: emailWork.prevEmail,
            type: "outbid",
            errorMessage: e?.message ?? String(e),
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    if (msg === "AUCTION_NOT_OPEN") return jsonError("Auction is not open.", 403);
    if (msg === "ITEM_NOT_FOUND") return jsonError("Item not found.", 404);
    if (msg === "PROFILE_INCOMPLETE")
      return jsonError("Please complete your profile (name + phone) before bidding.", 403);
    if (msg === "BID_TOO_LOW") return jsonError("Bid too low.", 400);
    if (msg === "RATE_LIMIT") return jsonError("Please wait 30 seconds before bidding again.", 429);
    return jsonError("Failed to place bid.", 500);
  }
}

