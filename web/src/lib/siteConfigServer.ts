import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import type { SiteConfig } from "@/lib/siteConfig";

const FALLBACK_SITE: SiteConfig = {
  orgName: "Care Community Services Society",
  eventTitle: "Give with Heart: CPT Silent Auction 2025",
  faviconUrl: "",
  logoUrl: "",
  primaryColour: "#F97316",
};

export async function getSiteConfigServer(): Promise<SiteConfig> {
  try {
    const snap = await getAdminDb().doc("config/site").get();
    if (!snap.exists) return FALLBACK_SITE;
    const data = snap.data() as Partial<SiteConfig>;
    return {
      orgName: data.orgName ?? FALLBACK_SITE.orgName,
      eventTitle: data.eventTitle ?? FALLBACK_SITE.eventTitle,
      faviconUrl: data.faviconUrl ?? "",
      logoUrl: data.logoUrl ?? "",
      primaryColour: data.primaryColour ?? "#F97316",
    };
  } catch {
    // Local builds may not have FIREBASE_SERVICE_ACCOUNT_KEY set.
    return FALLBACK_SITE;
  }
}

