 "use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { useAuction } from "@/components/AuctionProvider";
import { useAuth } from "@/components/AuthProvider";
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

  const dd = String(days).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return `${dd}D ${hh}Hr ${mm}Mn ${ss}s`;
}

export default function Home() {
  const { site, loading } = useSiteConfig();
  const { auction, loading: auctionLoading } = useAuction();
  const { user } = useAuth();
  const [featured, setFeatured] = useState<ItemRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const [countdownFlash, setCountdownFlash] = useState(false);

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
    // Lightweight "tick" animation for countdown changes.
    setCountdownFlash(true);
    const t = window.setTimeout(() => setCountdownFlash(false), 180);
    return () => window.clearTimeout(t);
  }, [nowTick]);

  useEffect(() => {
    const unsub = subscribeFeaturedItems(setFeatured);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllItems(setItems);
    return () => unsub();
  }, []);

  const itemsCount = items.length;
  const showPrices = auction.status === "open" || auction.status === "closed";
  const incrementLabel = "+$5.00";

  return (
    <div className="flex flex-1 justify-center bg-[#F5F7FB] text-[#0B1F3A]">
      <main className="w-full max-w-6xl px-4 pb-16 sm:px-6">
        <section className="mt-6 overflow-hidden rounded-3xl bg-[#0B1F3A] shadow-sm">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(255,255,255,0.12),transparent_60%),radial-gradient(900px_circle_at_80%_30%,rgba(249,115,22,0.18),transparent_55%)]" />
            <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/10">
                  {auctionLoading ? "Loading…" : auction.status.replace("-", " ").toUpperCase()}
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Bid with heart.
                  <br />
                  Give with purpose.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                  {site?.orgName
                    ? `Every dollar raised supports ${site.orgName}.`
                    : "Every dollar raised supports our community programs."}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {user ? (
                    <a
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#F97316] px-6 text-sm font-semibold text-white hover:bg-[#EA580C]"
                      href="https://www.ccsscares.sg/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Learn More →
                    </a>
                  ) : (
                    <a
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#F97316] px-6 text-sm font-semibold text-white hover:bg-[#EA580C]"
                      href="/login?returnTo=%2F"
                    >
                      Register &amp; Start Bidding →
                    </a>
                  )}
                  <a
                    className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15"
                    href="#items"
                  >
                    View items
                  </a>
                </div>
              </div>

              <div className="rounded-2xl bg-white/6 p-5 ring-1 ring-white/10">
                <div className="text-xs font-semibold text-white/80">Closes (SGT)</div>
                {closeAtDate ? (
                  <>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {formatSgtDate(closeAtDate)}
                    </div>
                    <div className="mt-2 text-sm text-white/75">
                      Time left:{" "}
                      <span
                        className={`relative inline-flex items-center rounded-xl px-3 py-1 font-semibold text-white tabular-nums ring-1 ring-white/10 transition-transform duration-150 ${
                          countdownFlash ? "scale-[1.03]" : "scale-100"
                        } bg-white/10 bg-[linear-gradient(to_right,rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.16)_1px,transparent_1px)] bg-[size:14px_14px]`}
                      >
                        {timeLeftMs != null ? formatCountdown(timeLeftMs) : "—"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-white/75">Close time not set yet.</div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/8 p-3 ring-1 ring-white/10">
                    <div className="text-[10px] font-semibold tracking-wide text-white/70">
                      ITEMS LIVE
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{itemsCount}</div>
                  </div>
                  <div className="rounded-xl bg-white/8 p-3 ring-1 ring-white/10">
                    <div className="text-[10px] font-semibold tracking-wide text-white/70">
                      TOTAL RAISED
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      ${Number(auction.totalRaised ?? 0).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {auction.status === "pre-launch" ? (
          <section className="mt-12">
            <h2 className="text-lg font-semibold">Featured items</h2>
            <p className="mt-1 text-sm text-slate-600">
              A sneak peek. Full details and bidding will appear when the auction opens.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.length ? (
                featured.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
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
                    <div className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">
                      {it.title}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
                  No featured items yet. (Admin can mark items as featured.)
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-12" id="items">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Auction items</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {auction.status === "pre-launch"
                    ? "Preview the catalog. Prices appear when bidding opens."
                    : "Tap an item to view details and place a bid."}
                </p>
              </div>
              {!user ? (
                <a
                  className="hidden sm:inline-flex h-10 items-center justify-center rounded-full bg-[#0B1F3A] px-4 text-sm font-semibold text-white hover:bg-[#0A1A30]"
                  href="/login?returnTo=%2F"
                >
                  Register / Log in
                </a>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.length ? (
                items.map((it) => (
                  <a
                    key={it.id}
                    href={`/items/${it.id}`}
                    className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md"
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
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
                    <div className="mt-4">
                      <div className="text-sm font-semibold text-slate-900">{it.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                        {it.description || " "}
                      </div>

                      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
                        <div className="p-3">
                          <div className="text-[10px] font-semibold tracking-wide text-slate-500">
                            CURRENT BID
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                            {showPrices
                              ? `$${Number(it.currentHighestBid ?? it.startingBid ?? 0).toFixed(0)}`
                              : "—"}
                          </div>
                        </div>
                        <div className="border-l border-slate-100 p-3">
                          <div className="text-[10px] font-semibold tracking-wide text-slate-500">
                            INCREMENT
                          </div>
                          <div className="mt-1 text-lg font-semibold text-[#F97316] tabular-nums">
                            {incrementLabel}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#0B1F3A] px-4 text-sm font-semibold text-white transition-colors group-hover:bg-[#0A1A30]">
                        {showPrices ? "Bid Now" : "View details"}
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="col-span-full rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
                  No items yet. Add some in Staff Uploader (or run the dummy item seed script).
                </div>
              )}
            </div>
          </section>

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
          <footer className="mt-14 pb-10 text-xs text-slate-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>All times shown in SGT (UTC+8).</div>
              <div className="flex gap-4">
                <a className="hover:underline" href="/staff">
                  Staff login
                </a>
              </div>
            </div>
          </footer>
        ) : null}
      </main>
    </div>
  );
}
