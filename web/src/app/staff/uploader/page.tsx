"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getRoleClaim } from "@/lib/claims";
import { useAuction } from "@/components/AuctionProvider";
import { getFirestoreDb } from "@/lib/firebase/client";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import type { Item } from "@/lib/items";
import { uploadItemImage, validateSquareImageFile } from "@/lib/uploads";

type MyItemRow = { id: string } & Item;

export default function StaffUploaderPage() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const { auction } = useAuction();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingBid, setStartingBid] = useState<number | "">(50);
  const [isFeatured, setIsFeatured] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [myItems, setMyItems] = useState<MyItemRow[]>([]);

  useEffect(() => {
    if (!user) return;
    getRoleClaim(user, true).then((r) => setRole(r));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const firestore = getFirestoreDb();
    const q = query(
      collection(firestore, "items"),
      where("uploaderUid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMyItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Item) })));
      },
      () => setMyItems([]),
    );
    return () => unsub();
  }, [user]);

  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (!user) return <div className="p-8 text-sm">Please sign in at /staff.</div>;
  if (role !== "staff")
    return (
      <div className="p-8 text-sm">
        Not authorised for staff uploader yet. (An admin must assign your staff role claim.)
      </div>
    );

  const canEdit = auction.status !== "open";
  const canCreate = auction.status !== "closed";

  const filePreviews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => {
      filePreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [filePreviews]);

  async function onPickFiles(list: FileList | null) {
    setError(null);
    setMessage(null);
    if (!list) return;

    const picked = Array.from(list).slice(0, 4);
    const validated: File[] = [];

    for (const f of picked) {
      const v = await validateSquareImageFile(f);
      if (!v.ok) return setError(v.error);
      validated.push(f);
    }

    setFiles(validated);
  }

  async function createItem() {
    setError(null);
    setMessage(null);

    if (!user) return setError("You are not signed in.");
    if (!canCreate) return setError("Auction is closed. Uploads are disabled.");
    const t = title.trim();
    if (!t) return setError("Title is required.");
    const sb = typeof startingBid === "number" ? startingBid : NaN;
    if (!Number.isFinite(sb) || sb <= 0) return setError("Starting bid must be a positive number.");
    if (files.length === 0) return setError("Please add at least 1 photo.");

    setSaving(true);
    try {
      // Create Firestore doc first to get itemId.
      const firestore = getFirestoreDb();
      const docRef = await addDoc(collection(firestore, "items"), {
        title: t,
        description: description.trim(),
        photoUrls: [],
        startingBid: sb,
        currentHighestBid: sb,
        currentHighestBidderId: "",
        uploaderName: user.email || "Staff",
        uploaderUid: user.uid,
        isFeatured,
        createdAt: serverTimestamp(),
      });

      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadItemImage({
          uploaderUid: user.uid,
          itemId: docRef.id,
          index: i,
          file: files[i],
        });
        urls.push(url);
      }

      // Update photoUrls.
      await updateDoc(docRef, { photoUrls: urls });

      setTitle("");
      setDescription("");
      setStartingBid(50);
      setIsFeatured(false);
      setFiles([]);
      setMessage("Item uploaded successfully.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#FFF7ED] px-10 py-10 text-[#1C1917]">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Staff uploader</h1>
        <p className="mt-2 text-sm text-stone-600">
          Upload items for the auction. Editing is locked while the auction is live.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">New item</h2>
              <div className="text-xs text-stone-500">Status: {auction.status.toUpperCase()}</div>
            </div>

            {!canCreate ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                Auction is closed. Uploads are disabled.
              </div>
            ) : null}

            {auction.status === "open" ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                Auction is live. Existing items can’t be edited or deleted, but you can still add new items.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                {message}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              <div>
                <label className="text-sm font-medium">Photos (max 4)</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="staff-item-photos"
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      void onPickFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                    disabled={!canCreate || saving}
                  />
                  <label
                    htmlFor="staff-item-photos"
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                    aria-disabled={!canCreate || saving}
                  >
                    Choose photos…
                  </label>
                  <div className="text-xs text-stone-500">JPEG/PNG/WEBP</div>
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Square (1:1), JPEG/PNG/WEBP, max 2MB each.
                </p>
                {filePreviews.length ? (
                  <div className="mt-3 grid grid-cols-4 gap-3">
                    {filePreviews.map((src) => (
                      <div key={src} className="aspect-square overflow-hidden rounded-xl bg-stone-100">
                        <Image
                          src={src}
                          alt="Preview"
                          width={300}
                          height={300}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canCreate || saving}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  disabled={!canCreate || saving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Starting bid</label>
                  <input
                    className="mt-1 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#F97316]"
                    value={startingBid}
                    onChange={(e) => setStartingBid(e.target.value ? Number(e.target.value) : "")}
                    inputMode="numeric"
                    disabled={!canCreate || saving}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    id="featured"
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    disabled={!canCreate || saving}
                    className="h-4 w-4"
                  />
                  <label htmlFor="featured" className="text-sm font-medium">
                    Featured (pre-launch teaser)
                  </label>
                </div>
              </div>

              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                onClick={createItem}
                disabled={!canCreate || saving}
                type="button"
              >
                {saving ? "Uploading…" : "Upload item"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold">My uploaded items</h2>
            <p className="mt-1 text-xs text-stone-500">
              {canEdit ? "You can edit/delete before auction opens or after it closes." : "Auction live: read-only."}
            </p>

            <div className="mt-4 space-y-3">
              {myItems.length ? (
                myItems.map((it) => (
                  <a
                    key={it.id}
                    href={`/items/${it.id}`}
                    className="block rounded-xl border border-stone-200 bg-white p-3 hover:bg-stone-50"
                  >
                    <div className="text-sm font-semibold">{it.title}</div>
                    <div className="mt-1 text-xs text-stone-600">
                      Current: ${Number(it.currentHighestBid ?? it.startingBid ?? 0).toFixed(0)}
                      {it.isFeatured ? " · Featured" : ""}
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                  No items yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

