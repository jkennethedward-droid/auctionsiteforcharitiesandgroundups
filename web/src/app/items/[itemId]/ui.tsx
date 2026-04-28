"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import type { Item } from "@/lib/items";
import { useAuction } from "@/components/AuctionProvider";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { useAuth } from "@/components/AuthProvider";

const BID_AMOUNT_KEY = "gwh_pending_bid_amount";

export default function ItemClient() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId;
  const router = useRouter();

  const { auction, loading: auctionLoading } = useAuction();
  const { site } = useSiteConfig();
  const { user, loading: authLoading } = useAuth();

  const [item, setItem] = useState<(Item & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [bidAmount, setBidAmount] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    const firestore = getFirestoreDb();
    const ref = doc(firestore, "items", itemId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setItem(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as Item;
        setItem({ id: snap.id, ...data });
        setLoading(false);
      },
      () => {
        setItem(null);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [itemId]);

  useEffect(() => {
    // Pre-launch: item pages not accessible.
    if (auctionLoading) return;
    if (auction.status === "pre-launch") router.replace("/");
  }, [auction.status, auctionLoading, router]);

  const minBid = useMemo(() => {
    if (!item) return 0;
    const current = Number(item.currentHighestBid ?? 0);
    const starting = Number(item.startingBid ?? 0);
    if (!current || current <= 0) return starting;
    // Minimum increment is $5.
    return Math.max(starting, current + 5);
  }, [item]);

  useEffect(() => {
    // Prefill bid amount.
    if (!item) return;
    setBidAmount(minBid);
  }, [item, minBid]);

  const photos = item?.photoUrls ?? [];
  const selectedPhoto = photos[selectedIdx] ?? photos[0] ?? null;

  const itemUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin + `/items/${itemId}`;
  }, [itemId]);

  const whatsappHref = useMemo(() => {
    const title = item?.title || "this item";
    const eventTitle = site?.eventTitle || "the auction";
    const text = `Bid on ${title} at ${eventTitle}!\nPlace your bid here: ${itemUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [item?.title, itemUrl, site?.eventTitle]);

  const linkedInHref = useMemo(() => {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(itemUrl)}`;
  }, [itemUrl]);

  async function handlePlaceBid() {
    setError(null);
    setBanner(null);

    if (auction.status !== "open") {
      setError("Auction has closed.");
      return;
    }

    const amount = typeof bidAmount === "number" ? bidAmount : NaN;
    if (!Number.isFinite(amount)) return setError("Enter a bid amount.");
    if (amount < minBid) return setError(`Minimum bid is $${minBid}.`);

    if (authLoading) return;
    if (!user) {
      // Save the pending amount so after login we can restore it.
      window.localStorage.setItem(BID_AMOUNT_KEY, String(amount));
      router.push(`/login?returnTo=${encodeURIComponent(`/items/${itemId}`)}`);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ itemId, amount }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "Failed to place bid.");
        return;
      }

      setBanner(`Your bid of $${amount} has been placed!`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to place bid.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(itemUrl);
      setShareToast("Copied!");
      setTimeout(() => setShareToast(null), 1500);
    } catch {
      setShareToast("Copy failed");
      setTimeout(() => setShareToast(null), 1500);
    }
  }

  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (!item) return <div className="p-8 text-sm">Item not found.</div>;

  return (
    <div className="flex flex-1 justify-center bg-[#FFF7ED] px-4 py-8 text-[#1C1917] sm:px-6 sm:py-12">
      <main className="w-full max-w-5xl">
        <a href="/" className="text-sm font-semibold text-stone-700 hover:underline">
          ← Back to items
        </a>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">
              {selectedPhoto ? (
                <Image
                  src={selectedPhoto}
                  alt={item.title}
                  width={900}
                  height={900}
                  className="h-full w-full object-cover"
                  priority
                />
              ) : null}
            </div>

            {photos.length > 1 ? (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {photos.slice(0, 4).map((url, idx) => (
                  <button
                    key={url}
                    className={`aspect-square overflow-hidden rounded-xl border ${
                      idx === selectedIdx ? "border-[#F97316]" : "border-stone-200"
                    } bg-stone-100`}
                    onClick={() => setSelectedIdx(idx)}
                    type="button"
                    aria-label={`View photo ${idx + 1}`}
                  >
                    <Image
                      src={url}
                      alt={`${item.title} thumbnail ${idx + 1}`}
                      width={300}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-full bg-[#FFF7ED] px-3 py-1 text-sm font-medium text-[#9A3412]">
                {auction.status.toUpperCase()}
              </div>

              <div className="relative">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-50"
                  type="button"
                  onClick={() => setShareOpen((s) => !s)}
                >
                  Share
                </button>

                {shareOpen ? (
                  <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-lg">
                    <a
                      className="block rounded-xl px-3 py-2 text-sm hover:bg-stone-50"
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                    <a
                      className="block rounded-xl px-3 py-2 text-sm hover:bg-stone-50"
                      href={linkedInHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LinkedIn
                    </a>
                    <button
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-stone-50"
                      type="button"
                      onClick={copyLink}
                    >
                      Copy link
                    </button>
                  </div>
                ) : null}

                {shareToast ? (
                  <div className="absolute right-0 mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                    {shareToast}
                  </div>
                ) : null}
              </div>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{item.title}</h1>
            <p className="mt-1 text-sm text-stone-600">Uploaded by {item.uploaderName}</p>

            <div className="mt-6 grid gap-3 rounded-2xl bg-stone-50 p-4">
              <div className="flex items-baseline justify-between">
                <div className="text-sm text-stone-600">Current highest bid</div>
                <div className="text-lg font-semibold">
                  ${Number(item.currentHighestBid ?? item.startingBid ?? 0).toFixed(0)}
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-sm text-stone-600">Minimum bid</div>
                <div className="text-sm font-semibold">${Number(minBid).toFixed(0)}</div>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {item.description || "—"}
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-stone-200 p-4">
              <h2 className="text-sm font-semibold">Place a bid</h2>

              {auction.status !== "open" ? (
                <p className="mt-2 text-sm text-stone-600">Auction has closed.</p>
              ) : (
                <>
                  <div className="mt-3 flex gap-3">
                    <input
                      className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value ? Number(e.target.value) : "")}
                      inputMode="numeric"
                      placeholder={`${minBid}`}
                    />
                    <button
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]"
                      onClick={handlePlaceBid}
                      type="button"
                    >
                      Place Bid
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    Minimum increment is $5. {site?.orgName ? `Every bid supports ${site.orgName}.` : ""}
                  </p>
                </>
              )}

              {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              {banner ? (
                <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  {banner}
                </div>
              ) : null}
            </div>

            <div className="mt-6 text-xs text-stone-500">
              All times and timestamps are in SGT (UTC+8).
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

