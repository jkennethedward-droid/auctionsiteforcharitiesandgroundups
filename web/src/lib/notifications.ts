"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

export type NotificationRow = {
  id: string;
  itemId: string;
  itemTitle: string;
  newHighestBid: number;
  read: boolean;
  createdAt?: Timestamp;
};

export function notificationsRef(uid: string) {
  return collection(firestore, "users", uid, "notifications");
}

export function unreadNotificationsQuery(uid: string) {
  return query(
    notificationsRef(uid),
    where("read", "==", false),
    orderBy("createdAt", "desc"),
    limit(20),
  );
}

export function recentNotificationsQuery(uid: string) {
  return query(notificationsRef(uid), orderBy("createdAt", "desc"), limit(20));
}

export async function markAllNotificationsRead(uid: string) {
  const q = unreadNotificationsQuery(uid);
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(firestore);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

