import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

export type UserProfile = {
  name: string;
  email: string;
  phone?: string;
  department?: string;
  role?: string;
  createdAt?: unknown;
};

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(firestore, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function upsertUserProfile(
  uid: string,
  profile: Omit<UserProfile, "createdAt">,
) {
  const ref = doc(firestore, "users", uid);
  await setDoc(
    ref,
    {
      ...profile,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

