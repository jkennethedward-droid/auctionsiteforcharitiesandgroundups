"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import type { SiteConfig } from "@/lib/siteConfig";

type SiteConfigContextValue = {
  site: SiteConfig | null;
  loading: boolean;
};

const SiteConfigContext = createContext<SiteConfigContextValue | undefined>(undefined);

const DEFAULT_SITE: SiteConfig = {
  orgName: "",
  eventTitle: "",
  faviconUrl: "",
  logoUrl: "",
  primaryColour: "#F97316",
};

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const firestore = getFirestoreDb();
    const ref = doc(firestore, "config", "site");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.exists() ? (snap.data() as Partial<SiteConfig>) : {}) ?? {};
        setSite({
          ...DEFAULT_SITE,
          ...data,
          primaryColour: data.primaryColour ?? "#F97316",
        });
        setLoading(false);
      },
      () => {
        // If rules/network block, don't crash UI.
        setSite(DEFAULT_SITE);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ site, loading }), [site, loading]);
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error("useSiteConfig must be used within <SiteConfigProvider>");
  return ctx;
}

