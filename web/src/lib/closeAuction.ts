import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { sendResendEmail } from "@/lib/resend";

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
  type: "winner";
  itemId: string;
  itemTitle: string;
  errorMessage: string;
}) {
  await adminDb.doc(`logs/failedEmails`).collection("entries").add({
    recipient: args.recipient,
    type: args.type,
    itemId: args.itemId,
    itemTitle: args.itemTitle,
    timestamp: new Date(),
    errorMessage: args.errorMessage,
  });
}

export async function closeAuctionAndPublishWinners(opts?: { force?: boolean }) {
  const force = Boolean(opts?.force);

  const [auctionSnap, siteSnap] = await Promise.all([
    adminDb.doc("config/auction").get(),
    adminDb.doc("config/site").get(),
  ]);

  const auction = auctionSnap.exists ? (auctionSnap.data() as any) : null;
  if (!auction) throw new Error("Missing config/auction");

  const status = String(auction.status || "pre-launch");
  const closeAt = auction.closeAt?.toDate ? auction.closeAt.toDate() : null;
  const now = new Date();

  if (!force) {
    if (status !== "open") throw new Error("Auction is not open.");
    if (!closeAt) throw new Error("closeAt not set.");
    if (now.getTime() < closeAt.getTime()) throw new Error("Too early to close.");
  }

  const site = siteSnap.exists ? (siteSnap.data() as any) : {};
  const eventTitle = String(site.eventTitle || "Silent Auction");
  const orgName = String(site.orgName || "");

  const itemsSnap = await adminDb.collection("items").get();
  const winners: { itemId: string; itemTitle: string; winnerName: string; amount: number }[] = [];

  for (const itemDoc of itemsSnap.docs) {
    const itemId = itemDoc.id;
    const item = itemDoc.data() as any;
    const itemTitle = String(item.title || "Item");

    const bidsQ = adminDb
      .collection("bids")
      .where("itemId", "==", itemId)
      .orderBy("amount", "desc")
      .orderBy("timestamp", "desc")
      .limit(1);

    const topSnap = await bidsQ.get();
    if (topSnap.empty) continue;

    const bidDoc = topSnap.docs[0];
    const bid = bidDoc.data() as any;
    const amount = Number(bid.amount || 0);
    const winnerName = String(bid.bidderName || "");
    const winnerEmail = String(bid.bidderEmail || "");

    winners.push({ itemId, itemTitle, winnerName, amount });

    // Mark winning bid.
    await bidDoc.ref.set(
      {
        isWinner: true,
      },
      { merge: true },
    );

    // Send winner email best-effort, then update flags.
    if (winnerEmail) {
      try {
        await sendResendEmail({
          to: winnerEmail,
          subject: `You won ${itemTitle}!`,
          html: winnerHtml({
            eventTitle,
            name: winnerName || "there",
            itemTitle,
            amount,
            orgName,
          }),
        });

        await bidDoc.ref.set(
          {
            winnerEmailSent: true,
            winnerEmailSentAt: new Date(),
          },
          { merge: true },
        );
      } catch (e: any) {
        await logFailedEmail({
          recipient: winnerEmail,
          type: "winner",
          itemId,
          itemTitle,
          errorMessage: e?.message ?? String(e),
        });
      }
    }
  }

  const totalRaised = winners.reduce((sum, w) => sum + Number(w.amount || 0), 0);

  await adminDb.doc("config/auction").set(
    {
      status: "closed",
      winnersPublished: true,
      totalRaised,
      winners,
    },
    { merge: true },
  );

  return { winnersCount: winners.length, totalRaised };
}

