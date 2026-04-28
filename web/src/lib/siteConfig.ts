import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

export type SiteConfig = {
  orgName: string;
  eventTitle: string;
  faviconUrl: string;
  logoUrl: string;
  primaryColour: string;
};

export async function getSiteConfig(): Promise<SiteConfig> {
  const ref = doc(firestore, "config", "site");
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Missing Firestore doc: config/site");

  const data = snap.data() as Partial<SiteConfig>;
  return {
    orgName: data.orgName ?? "",
    eventTitle: data.eventTitle ?? "",
    faviconUrl: data.faviconUrl ?? "",
    logoUrl: data.logoUrl ?? "",
    primaryColour: data.primaryColour ?? "#F97316",
  };
}

export async function getStaffDomains(): Promise<string[]> {
  const ref = doc(firestore, "config", "staffDomains");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as { domains?: unknown };
  if (!Array.isArray(data.domains)) return [];
  return data.domains.filter((d): d is string => typeof d === "string");
}

