"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getRoleClaim } from "@/lib/claims";
import Image from "next/image";
import {
  Timestamp,
  doc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { uploadBrandAsset } from "@/lib/uploads";
import { useAuction } from "@/components/AuctionProvider";
import { subscribeAllItems, type ItemRow } from "@/lib/items";

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busySite, setBusySite] = useState(false);
  const [busyAuction, setBusyAuction] = useState(false);
  const [busyClose, setBusyClose] = useState(false);

  const [staffUsers, setStaffUsers] = useState<
    { uid: string; email?: string; name?: string; department?: string }[]
  >([]);

  const { site } = useSiteConfig();
  const { auction } = useAuction();
  const [orgName, setOrgName] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [primaryColour, setPrimaryColour] = useState("#F97316");

  const [auctionStatus, setAuctionStatus] = useState<"pre-launch" | "open" | "closed">(
    "pre-launch",
  );
  const [closeAtLocalSgt, setCloseAtLocalSgt] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedBidItemId, setSelectedBidItemId] = useState<string>("");
  const [bids, setBids] = useState<
    {
      id: string;
      bidderName: string;
      bidderEmail: string;
      bidderPhone: string;
      amount: number;
      timestamp?: Timestamp;
      isWinner?: boolean;
    }[]
  >([]);
  const [busyPromote, setBusyPromote] = useState(false);
  const [failedEmails, setFailedEmails] = useState<
    {
      id: string;
      recipient: string;
      type: string;
      itemTitle?: string;
      timestamp?: Timestamp;
      errorMessage?: string;
    }[]
  >([]);
  const [winnerBids, setWinnerBids] = useState<
    {
      id: string;
      itemId: string;
      bidderName: string;
      bidderEmail: string;
      bidderPhone: string;
      amount: number;
      timestamp?: Timestamp;
      winnerEmailSent?: boolean;
      winnerEmailSentAt?: Timestamp;
    }[]
  >([]);

  useEffect(() => {
    if (!user) return;
    getRoleClaim(user, true).then((r) => setRole(r));
  }, [user]);

  useEffect(() => {
    if (!site) return;
    setOrgName(site.orgName || "");
    setEventTitle(site.eventTitle || "");
    setPrimaryColour(site.primaryColour || "#F97316");
  }, [site]);

  useEffect(() => {
    setAuctionStatus(auction.status);
    if (auction.closeAt) {
      const d = auction.closeAt.toDate();
      const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(d)
        .reduce<Record<string, string>>((acc, p) => {
          if (p.type !== "literal") acc[p.type] = p.value;
          return acc;
        }, {});
      setCloseAtLocalSgt(
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`,
      );
    }
  }, [auction.closeAt, auction.status]);

  useEffect(() => {
    const unsub = subscribeAllItems(setItems);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!items.length) return;
    if (selectedBidItemId) return;
    setSelectedBidItemId(items[0].id);
  }, [items, selectedBidItemId]);

  useEffect(() => {
    if (!selectedBidItemId) {
      setBids([]);
      return;
    }

    const q = query(
      collection(firestore, "bids"),
      where("itemId", "==", selectedBidItemId),
      orderBy("amount", "desc"),
      orderBy("timestamp", "desc"),
      limit(100),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setBids(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              bidderName: String(data.bidderName || ""),
              bidderEmail: String(data.bidderEmail || ""),
              bidderPhone: String(data.bidderPhone || ""),
              amount: Number(data.amount || 0),
              timestamp: data.timestamp as Timestamp | undefined,
              isWinner: Boolean(data.isWinner),
            };
          }),
        );
      },
      () => setBids([]),
    );
    return () => unsub();
  }, [selectedBidItemId]);

  useEffect(() => {
    if (role !== "admin") return;
    const q = query(
      collection(firestore, "logs", "failedEmails", "entries"),
      orderBy("timestamp", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFailedEmails(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              recipient: String(data.recipient || ""),
              type: String(data.type || ""),
              itemTitle: data.itemTitle ? String(data.itemTitle) : "",
              timestamp: data.timestamp as Timestamp | undefined,
              errorMessage: data.errorMessage ? String(data.errorMessage) : "",
            };
          }),
        );
      },
      () => setFailedEmails([]),
    );
    return () => unsub();
  }, [role]);

  useEffect(() => {
    if (role !== "admin") return;
    const q = query(
      collection(firestore, "bids"),
      where("isWinner", "==", true),
      orderBy("timestamp", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWinnerBids(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              itemId: String(data.itemId || ""),
              bidderName: String(data.bidderName || ""),
              bidderEmail: String(data.bidderEmail || ""),
              bidderPhone: String(data.bidderPhone || ""),
              amount: Number(data.amount || 0),
              timestamp: data.timestamp as Timestamp | undefined,
              winnerEmailSent: Boolean(data.winnerEmailSent),
              winnerEmailSentAt: data.winnerEmailSentAt as Timestamp | undefined,
            };
          }),
        );
      },
      () => setWinnerBids([]),
    );
    return () => unsub();
  }, [role]);

  const closeAtPreview = useMemo(() => {
    if (!closeAtLocalSgt) return null;
    const d = new Date(`${closeAtLocalSgt}:00+08:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }, [closeAtLocalSgt]);

  useEffect(() => {
    if (!user) return;
    if (role !== "admin") return;

    const q = query(
      collection(firestore, "users"),
      where("role", "==", "staff"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStaffUsers(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              uid: d.id,
              email: data.email,
              name: data.name,
              department: data.department,
            };
          }),
        );
      },
      () => setStaffUsers([]),
    );
    return () => unsub();
  }, [role, user]);

  async function setStaffClaim(uid: string, next: "staff" | "none") {
    if (!user) return;
    setError(null);
    setMessage(null);
    setBusyUid(uid);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid, role: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to update claims.");

      setMessage(next === "staff" ? "Staff role granted." : "Staff role removed.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update claims.");
    } finally {
      setBusyUid(null);
    }
  }

  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (!user) return <div className="p-8 text-sm">Please sign in at /admin.</div>;
  if (role !== "admin") return <div className="p-8 text-sm">Not authorised as admin.</div>;

  async function saveAuctionControl() {
    setError(null);
    setMessage(null);
    setBusyAuction(true);
    try {
      const ref = doc(firestore, "config", "auction");
      const closeAtDate = closeAtLocalSgt ? new Date(`${closeAtLocalSgt}:00+08:00`) : null;
      if (closeAtLocalSgt && (!closeAtDate || Number.isNaN(closeAtDate.getTime()))) {
        throw new Error("Invalid close time.");
      }

      await setDoc(
        ref,
        {
          status: auctionStatus,
          closeAt: closeAtDate ? Timestamp.fromDate(closeAtDate) : null,
        },
        { merge: true },
      );
      setMessage("Auction settings saved.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save auction settings.");
    } finally {
      setBusyAuction(false);
    }
  }

  async function toggleFeatured(itemId: string, next: boolean) {
    setError(null);
    setMessage(null);
    try {
      await updateDoc(doc(firestore, "items", itemId), { isFeatured: next });
      setMessage(next ? "Marked as featured." : "Removed from featured.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update featured flag.");
    }
  }

  async function closeAuctionNow() {
    if (!user) return;
    setError(null);
    setMessage(null);
    setBusyClose(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/close-auction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to close auction.");
      setMessage(`Auction closed. Winners: ${json.winnersCount}. Total raised: $${json.totalRaised}.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to close auction.");
    } finally {
      setBusyClose(false);
    }
  }

  async function promoteNextWinner() {
    if (!user) return;
    if (!selectedBidItemId) return;
    setError(null);
    setMessage(null);
    setBusyPromote(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/promote-winner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ itemId: selectedBidItemId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to promote winner.");
      setMessage(`Winner promoted: ${json.winnerName} ($${json.amount}).`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to promote winner.");
    } finally {
      setBusyPromote(false);
    }
  }

  async function downloadCsv(kind: "all-bids" | "winners") {
    if (!user) return;
    setError(null);
    setMessage(null);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch(`/api/admin/export?kind=${encodeURIComponent(kind)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "winners" ? "winners.csv" : "all-bids.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "Export failed.");
    }
  }

  async function saveSiteSettings() {
    setError(null);
    setMessage(null);
    setBusySite(true);
    try {
      const ref = doc(firestore, "config", "site");
      await setDoc(
        ref,
        {
          orgName: orgName.trim(),
          eventTitle: eventTitle.trim(),
          primaryColour: primaryColour.trim() || "#F97316",
        },
        { merge: true },
      );
      setMessage("Site settings saved.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save site settings.");
    } finally {
      setBusySite(false);
    }
  }

  async function uploadAndSave(kind: "logo" | "favicon", file: File) {
    setError(null);
    setMessage(null);
    setBusySite(true);
    try {
      const url = await uploadBrandAsset({ kind, file });
      const ref = doc(firestore, "config", "site");
      await setDoc(ref, kind === "logo" ? { logoUrl: url } : { faviconUrl: url }, { merge: true });
      setMessage(`${kind === "logo" ? "Logo" : "Favicon"} uploaded.`);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed.");
    } finally {
      setBusySite(false);
    }
  }

  return (
    <div className="min-h-full bg-[#FFF7ED] px-10 py-10 text-[#1C1917]">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="mt-2 text-sm text-stone-600">
          Staff approvals: after a staff user logs in once, approve them here to grant the <code>role=staff</code> claim.
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {message}
          </div>
        ) : null}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Site settings</h2>
          <p className="mt-1 text-xs text-stone-500">
            These values are stored in Firestore at <code>config/site</code> and apply globally. No hardcoding.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organisation name</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={busySite}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Event title</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  disabled={busySite}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Primary colour</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                  value={primaryColour}
                  onChange={(e) => setPrimaryColour(e.target.value)}
                  placeholder="#F97316"
                  disabled={busySite}
                />
              </div>

              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                onClick={saveSiteSettings}
                disabled={busySite}
                type="button"
              >
                {busySite ? "Saving…" : "Save settings"}
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="text-xs font-semibold text-stone-700">Current logo</div>
                <div className="mt-3 h-24 w-24 overflow-hidden rounded-xl bg-white">
                  {site?.logoUrl ? (
                    <Image
                      src={site.logoUrl}
                      alt="Logo"
                      width={200}
                      height={200}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-stone-500">
                      (none)
                    </div>
                  )}
                </div>
                <input
                  className="mt-3 block w-full text-sm"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAndSave("logo", f);
                  }}
                  disabled={busySite}
                />
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="text-xs font-semibold text-stone-700">Current favicon</div>
                <div className="mt-3 h-12 w-12 overflow-hidden rounded-xl bg-white">
                  {site?.faviconUrl ? (
                    <Image
                      src={site.faviconUrl}
                      alt="Favicon"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-stone-500">
                      (none)
                    </div>
                  )}
                </div>
                <input
                  className="mt-3 block w-full text-sm"
                  type="file"
                  accept="image/*,.ico"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAndSave("favicon", f);
                  }}
                  disabled={busySite}
                />
                <div className="mt-2 text-xs text-stone-500">PNG/ICO recommended.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Auction control</h2>
          <p className="mt-1 text-xs text-stone-500">
            Stored at <code>config/auction</code>. Close time is treated as SGT (UTC+8).
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                  value={auctionStatus}
                  onChange={(e) => setAuctionStatus(e.target.value as any)}
                  disabled={busyAuction}
                >
                  <option value="pre-launch">pre-launch</option>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Close at (SGT)</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                  type="datetime-local"
                  value={closeAtLocalSgt}
                  onChange={(e) => setCloseAtLocalSgt(e.target.value)}
                  disabled={busyAuction}
                />
                <p className="mt-2 text-xs text-stone-500">
                  Preview:{" "}
                  {closeAtPreview
                    ? new Intl.DateTimeFormat("en-SG", {
                        timeZone: "Asia/Singapore",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(closeAtPreview)
                    : "(not set)"}
                </p>
              </div>

              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                onClick={saveAuctionControl}
                disabled={busyAuction}
                type="button"
              >
                {busyAuction ? "Saving…" : "Save auction settings"}
              </button>

              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-60"
                onClick={closeAuctionNow}
                disabled={busyClose}
                type="button"
              >
                {busyClose ? "Closing…" : "Close auction + publish winners now"}
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
                <div className="text-xs font-semibold text-stone-700">Current values</div>
                <div className="mt-2 text-sm text-stone-700">
                  Status: <b>{auction.status}</b>
                </div>
                <div className="mt-1 text-sm text-stone-700">
                  CloseAt:{" "}
                  <b>
                    {auction.closeAt
                      ? new Intl.DateTimeFormat("en-SG", {
                          timeZone: "Asia/Singapore",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(auction.closeAt.toDate())
                      : "(not set)"}
                  </b>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="text-xs font-semibold text-stone-700">Featured items (pre-launch)</div>
                <p className="mt-1 text-xs text-stone-500">
                  Toggle <code>isFeatured</code> per item.
                </p>
                <div className="mt-3 max-h-64 overflow-auto space-y-2">
                  {items.length ? (
                    items.map((it) => (
                      <label
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                      >
                        <span className="truncate">
                          <span className="font-semibold">{it.title}</span>{" "}
                          <span className="text-xs text-stone-500">({it.uploaderName})</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={!!it.isFeatured}
                          onChange={(e) => void toggleFeatured(it.id, e.target.checked)}
                        />
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-stone-600">No items yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Bid log</h2>
          <p className="mt-1 text-xs text-stone-500">
            Admin-only view of bids (sorted by amount desc). Winner row is highlighted. Use “Remove Winner” to promote the next highest bid.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xl">
              <label className="text-sm font-medium">Item</label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                value={selectedBidItemId}
                onChange={(e) => setSelectedBidItemId(e.target.value)}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.title}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-stone-500">If this errors, Firebase may ask you to create an index for the bids query.</div>
            </div>

            <button
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-60"
              type="button"
              onClick={promoteNextWinner}
              disabled={busyPromote}
            >
              {busyPromote ? "Working…" : "Remove Winner → Promote next"}
            </button>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-600">
                <tr>
                  <th className="px-3 py-2">Winner</th>
                  <th className="px-3 py-2">Bidder</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Timestamp (SGT)</th>
                </tr>
              </thead>
              <tbody>
                {bids.length ? (
                  bids.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-t border-stone-100 ${b.isWinner ? "bg-[#FFF7ED]" : ""}`}
                    >
                      <td className="px-3 py-2">{b.isWinner ? "🏆" : ""}</td>
                      <td className="px-3 py-2">{b.bidderName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.bidderEmail}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.bidderPhone}</td>
                      <td className="px-3 py-2 font-semibold">${Number(b.amount).toFixed(0)}</td>
                      <td className="px-3 py-2">
                        {b.timestamp
                          ? new Intl.DateTimeFormat("en-SG", {
                              timeZone: "Asia/Singapore",
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(b.timestamp.toDate())
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-sm text-stone-600" colSpan={6}>
                      No bids found for this item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Winners overview</h2>
          <p className="mt-1 text-xs text-stone-500">
            Admin-only winner contact view. Export CSV at the bottom.
          </p>

          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-600">
                <tr>
                  <th className="px-3 py-2">Item ID</th>
                  <th className="px-3 py-2">Winner name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Winning bid</th>
                  <th className="px-3 py-2">Winner email sent</th>
                  <th className="px-3 py-2">Email sent at (SGT)</th>
                </tr>
              </thead>
              <tbody>
                {winnerBids.length ? (
                  winnerBids.map((w) => (
                    <tr key={w.id} className="border-t border-stone-100">
                      <td className="px-3 py-2 font-mono text-xs">{w.itemId}</td>
                      <td className="px-3 py-2">{w.bidderName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{w.bidderEmail}</td>
                      <td className="px-3 py-2 font-mono text-xs">{w.bidderPhone}</td>
                      <td className="px-3 py-2 font-semibold">${Number(w.amount).toFixed(0)}</td>
                      <td className="px-3 py-2">{w.winnerEmailSent ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        {w.winnerEmailSentAt
                          ? new Intl.DateTimeFormat("en-SG", {
                              timeZone: "Asia/Singapore",
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(w.winnerEmailSentAt.toDate())
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-sm text-stone-600" colSpan={7}>
                      No winners yet. Close the auction first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50"
              type="button"
              onClick={() => void downloadCsv("all-bids")}
            >
              Download CSV: all bids
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              type="button"
              onClick={() => void downloadCsv("winners")}
            >
              Download CSV: winners only
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Staff users (from Firestore)</h2>
          <p className="mt-1 text-xs text-stone-500">
            This list shows users whose profile has <code>role="staff"</code>. Click “Grant staff claim” to enable `/staff/uploader`.
          </p>

          <div className="mt-4 space-y-3">
            {staffUsers.length ? (
              staffUsers.map((u) => (
                <div key={u.uid} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold">{u.name || "(no name yet)"}</div>
                      <div className="mt-1 text-xs text-stone-600">
                        {u.email || "(no email)"} · {u.department || "(no department)"} · UID:{" "}
                        <span className="font-mono">{u.uid}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                        onClick={() => setStaffClaim(u.uid, "staff")}
                        disabled={busyUid === u.uid}
                        type="button"
                      >
                        Grant staff claim
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-60"
                        onClick={() => setStaffClaim(u.uid, "none")}
                        disabled={busyUid === u.uid}
                        type="button"
                      >
                        Remove claim
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-stone-500">
                    After granting, ask staff to sign out/in (or refresh token) to receive the claim.
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                No staff profiles found yet. Have a staff user sign in via `/staff` first.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Failed email log</h2>
          <p className="mt-1 text-xs text-stone-500">
            Logs from Resend failures. These are stored under <code>logs/failedEmails/entries</code>.
          </p>

          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-600">
                <tr>
                  <th className="px-3 py-2">Recipient</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Timestamp (SGT)</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {failedEmails.length ? (
                  failedEmails.map((r) => (
                    <tr key={r.id} className="border-t border-stone-100">
                      <td className="px-3 py-2 font-mono text-xs">{r.recipient}</td>
                      <td className="px-3 py-2">{r.type}</td>
                      <td className="px-3 py-2">{r.itemTitle || "—"}</td>
                      <td className="px-3 py-2">
                        {r.timestamp
                          ? new Intl.DateTimeFormat("en-SG", {
                              timeZone: "Asia/Singapore",
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(r.timestamp.toDate())
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-700">
                        {r.errorMessage || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-sm text-stone-600" colSpan={5}>
                      No failed emails logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

