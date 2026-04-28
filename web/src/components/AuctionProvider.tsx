"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { AuctionConfig } from "@/lib/auction";
import { DEFAULT_AUCTION } from "@/lib/auction";

type AuctionContextValue = {
  auction: AuctionConfig;
  loading: boolean;
};

const AuctionContext = createContext<AuctionContextValue | undefined>(undefined);

export function AuctionProvider({ children }: { children: React.ReactNode }) {
  const [auction, setAuction] = useState<AuctionConfig>(DEFAULT_AUCTION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(firestore, "config", "auction");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.exists() ? (snap.data() as Partial<AuctionConfig>) : {}) ?? {};
        setAuction({
          ...DEFAULT_AUCTION,
          ...data,
          status: (data.status as AuctionConfig["status"]) ?? "pre-launch",
          closeAt: (data.closeAt as AuctionConfig["closeAt"]) ?? null,
          winnersPublished: Boolean(data.winnersPublished),
          totalRaised: Number((data as any).totalRaised ?? 0),
          winners: Array.isArray((data as any).winners) ? ((data as any).winners as any) : [],
        });
        setLoading(false);
      },
      () => {
        setAuction(DEFAULT_AUCTION);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ auction, loading }), [auction, loading]);
  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuction() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error("useAuction must be used within <AuctionProvider>");
  return ctx;
}

