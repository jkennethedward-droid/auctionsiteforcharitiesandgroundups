 "use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { useAuction } from "@/components/AuctionProvider";
import { subscribeAllItems, subscribeFeaturedItems, type ItemRow } from "@/lib/items";

function formatSgtDate(d: Date) {
  // SGT = Asia/Singapore (UTC+8)
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function msUntil(target: Date) {
  return target.getTime() - Date.now();
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${hours}h ${mins}m ${secs}s`;
}

export default function Home() {
  const { site, loading } = useSiteConfig();
  const { auction, loading: auctionLoading } = useAuction();
  const [featured, setFeatured] = useState<ItemRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [nowTick, setNowTick] = useState(0);

  const closeAtDate = useMemo(() => {
    const ts = auction.closeAt;
    return ts ? ts.toDate() : null;
  }, [auction.closeAt]);

  const timeLeftMs = useMemo(() => {
    if (!closeAtDate) return null;
    return msUntil(closeAtDate);
  }, [closeAtDate, nowTick]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = subscribeFeaturedItems(setFeatured);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (auction.status !== "open" && auction.status !== "closed") return;
    const unsub = subscribeAllItems(setItems);
    return () => unsub();
  }, [auction.status]);

  return (
    <div className="flex flex-1 justify-center bg-[#FFF7ED] px-4 py-10 text-[#1C1917] sm:px-6 sm:py-16">
      <main className="w-full max-w-5xl">
        <header className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-[#FFF7ED] px-3 py-1 text-sm font-medium text-[#9A3412]">
                {auctionLoading ? "Loading…" : auction.status.toUpperCase()}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {site?.eventTitle || "Silent Auction"}
              </h1>
              {site?.orgName ? (
                <p className="mt-1 text-sm text-stone-600">{site.orgName}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              {closeAtDate ? (
                <>
                  <div className="text-sm text-stone-600">Closes (SGT)</div>
                  <div className="text-sm font-semibold">{formatSgtDate(closeAtDate)}</div>
                  {timeLeftMs != null ? (
                    <div className="text-sm text-stone-600">
                      Time left: <span className="font-semibold text-stone-900">{formatCountdown(timeLeftMs)}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-stone-600">Close time not set yet.</div>
              )}
            </div>
          </div>

          <nav className="flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              href="/login?returnTo=%2F"
            >
              Log in to bid
            </a>
            <a
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50"
              href="/staff"
            >
              Staff
            </a>
            <a
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50"
              href="/admin"
            >
              Admin
            </a>
          </nav>
        </header>

        {auction.status === "pre-launch" ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Featured items</h2>
            <p className="mt-1 text-sm text-stone-600">
              A sneak peek. Full details and bidding will appear when the auction opens.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.length ? (
                featured.map((it) => (
                  <div key={it.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="aspect-square overflow-hidden rounded-xl bg-stone-100">
                      {it.photoUrls?.[0] ? (
                        <Image
                          src={it.photoUrls[0]}
                          alt={it.title}
                          width={600}
                          height={600}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="mt-3 text-sm font-semibold">{it.title}</div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-2xl bg-white p-6 text-sm text-stone-600 shadow-sm">
                  No featured items yet. (Admin can mark items as featured.)
                </div>
              )}
            </div>
          </section>
        ) : null}

        {auction.status === "open" ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Items</h2>
            <p className="mt-1 text-sm text-stone-600">
              Live auction. Bidding UI will be on each item page next.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <a key={it.id} href={`/items/${it.id}`} className="rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-square overflow-hidden rounded-xl bg-stone-100">
                    {it.photoUrls?.[0] ? (
                      <Image
                        src={it.photoUrls[0]}
                        alt={it.title}
                        width={600}
                        height={600}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm font-semibold">{it.title}</div>
                  <div className="mt-1 text-xs text-stone-600">Uploaded by {it.uploaderName}</div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">
                    Current: ${Number(it.currentHighestBid ?? it.startingBid ?? 0).toFixed(0)}
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {auction.status === "closed" ? (
          <section className="mt-10 rounded-2xl bg-white p-8 shadow-sm">
            <div className="inline-flex items-center rounded-full bg-[#FFF7ED] px-3 py-1 text-sm font-medium text-[#9A3412]">
              Auction Closed
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Congratulations to our winners!</h2>
            {auction.winnersPublished ? (
              <>
                <div className="mt-4 rounded-2xl bg-[#FFF7ED] p-4">
                  <div className="text-sm text-stone-600">Total raised</div>
                  <div className="mt-1 text-3xl font-semibold">${Number(auction.totalRaised ?? 0).toFixed(0)}</div>
                </div>

                <div className="mt-6 overflow-auto rounded-2xl border border-stone-200">
                  <table className="min-w-[640px] w-full text-left text-sm">
                    <thead className="bg-stone-50 text-xs text-stone-600">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Winner</th>
                        <th className="px-4 py-3">Winning bid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(auction.winners || []).map((w) => (
                        <tr key={w.itemId} className="border-t border-stone-100">
                          <td className="px-4 py-3 font-semibold">{w.itemTitle}</td>
                          <td className="px-4 py-3">{w.winnerName}</td>
                          <td className="px-4 py-3 font-semibold">${Number(w.amount).toFixed(0)}</td>
                        </tr>
                      ))}
                      {!(auction.winners || []).length ? (
                        <tr>
                          <td className="px-4 py-6 text-stone-600" colSpan={3}>
                            Winners have not been published yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                Winners are being prepared. Please check back soon.
              </p>
            )}
          </section>
        ) : null}

        {!loading && !auctionLoading ? (
          <footer className="mt-12 pb-8 text-xs text-stone-500">
            All times shown in SGT (UTC+8).
          </footer>
        ) : null}
      </main>
    </div>
  );
}
