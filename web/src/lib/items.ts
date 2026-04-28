import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

export type Item = {
  title: string;
  description: string;
  photoUrls: string[];
  startingBid: number;
  currentHighestBid: number;
  uploaderName: string;
  uploaderUid: string;
  isFeatured: boolean;
  createdAt?: unknown;
};

export type ItemRow = { id: string } & Item;

export function subscribeFeaturedItems(cb: (items: ItemRow[]) => void): Unsubscribe {
  const firestore = getFirestoreDb();
  const q = query(
    collection(firestore, "items"),
    where("isFeatured", "==", true),
    orderBy("createdAt", "desc"),
    limit(12),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Item) }));
      cb(items);
    },
    () => cb([]),
  );
}

export function subscribeAllItems(cb: (items: ItemRow[]) => void): Unsubscribe {
  const firestore = getFirestoreDb();
  const q = query(collection(firestore, "items"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Item) }));
      cb(items);
    },
    () => cb([]),
  );
}

