"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAuction } from "@/components/AuctionProvider";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

type Profile = {
  name?: string;
  email?: string;
  phone?: string;
};

type WinningBid = {
  id: string;
  itemId: string;
  amount: number;
  timestamp?: any;
};

type WinningItemRow = {
  itemId: string;
  title: string;
  amount: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { auction, loading: auctionLoading } = useAuction();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wins, setWins] = useState<WinningItemRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent("/profile")}`);
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    const firestore = getFirestoreDb();
    getDoc(doc(firestore, "users", user.uid))
      .then((snap) => {
        const data = snap.exists() ? (snap.data() as any) : {};
        setProfile({
          name: data?.name ? String(data.name) : user.displayName || "",
          email: data?.email ? String(data.email) : user.email || "",
          phone: data?.phone ? String(data.phone) : "",
        });
      })
      .catch(() => setProfile({ name: user.displayName || "", email: user.email || "", phone: "" }));
  }, [user]);

  const canShowWins = useMemo(() => auction.status === "closed" && !!auction.winnersPublished, [auction.status, auction.winnersPublished]);

  useEffect(() => {
    async function loadWins() {
      if (!user) return;
      if (auctionLoading) return;

      setBusy(true);
      setError(null);
      try {
        const firestore = getFirestoreDb();

        // Only show winners. Lost bids should not appear.
        if (!canShowWins) {
          setWins([]);
          return;
        }

        // Avoid composite index by not ordering; sort client-side if needed.
        const bidsQ = query(
          collection(firestore, "bids"),
          where("bidderId", "==", user.uid),
          where("isWinner", "==", true),
        );
        const bidsSnap = await getDocs(bidsQ);
        const bidRows: WinningBid[] = bidsSnap.docs.map((d) => {
          const b = d.data() as any;
          return {
            id: d.id,
            itemId: String(b.itemId || ""),
            amount: Number(b.amount || 0),
            timestamp: b.timestamp,
          };
        }).filter((b) => b.itemId);

        const itemIds = Array.from(new Set(bidRows.map((b) => b.itemId)));
        const itemSnaps = await Promise.all(
          itemIds.map((id) => getDoc(doc(firestore, "items", id)).catch(() => null)),
        );
        const titleById = new Map<string, string>();
        itemSnaps.forEach((s) => {
          if (!s || !("exists" in s) || !s.exists()) return;
          const data = s.data() as any;
          titleById.set(s.id, String(data?.title || s.id));
        });

        const merged: WinningItemRow[] = bidRows.map((b) => ({
          itemId: b.itemId,
          title: titleById.get(b.itemId) || b.itemId,
          amount: b.amount,
        }));

        // Sort by amount desc (simple + no index requirements)
        merged.sort((a, b) => b.amount - a.amount);
        setWins(merged);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load profile.");
      } finally {
        setBusy(false);
      }
    }
    void loadWins();
  }, [auctionLoading, canShowWins, user]);

  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (!user) return <div className="p-8 text-sm">Redirecting…</div>;

  return (
    <div className="flex flex-1 justify-center bg-[#FFF7ED] px-4 py-8 text-[#1C1917] sm:px-6 sm:py-12">
      <main className="w-full max-w-4xl">
        <a href="/" className="text-sm font-semibold text-stone-700 hover:underline">
          ← Back to items
        </a>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">My profile</h1>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-stone-500">Name</div>
              <div className="mt-1 text-sm">{profile?.name || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-500">Email</div>
              <div className="mt-1 text-sm">{profile?.email || user.email || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-500">Phone</div>
              <div className="mt-1 text-sm">{profile?.phone || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-500">Status</div>
              <div className="mt-1 text-sm">{auction.status.toUpperCase()}</div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">My winning items</h2>
          <p className="mt-1 text-xs text-stone-500">
            Only winning bids appear here after the auction closes.
          </p>

          {!canShowWins ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              Winners aren’t published yet.
            </div>
          ) : busy ? (
            <div className="mt-4 text-sm text-stone-600">Loading winning items…</div>
          ) : wins.length ? (
            <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs text-stone-600">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Winning bid</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {wins.map((w) => (
                    <tr key={`${w.itemId}:${w.amount}`} className="border-t border-stone-100">
                      <td className="px-4 py-3 font-semibold">{w.title}</td>
                      <td className="px-4 py-3 font-semibold">${Number(w.amount).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right">
                        <a className="text-sm font-semibold text-[#F97316] hover:underline" href={`/items/${w.itemId}`}>
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              No winning items found.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

