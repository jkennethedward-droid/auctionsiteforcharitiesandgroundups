import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import ItemClient from "./ui";
import { getAdminDb } from "@/lib/firebase/admin";
import { getSiteConfigServer } from "@/lib/siteConfigServer";

type Params = { itemId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { itemId } = await params;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const originFromReq = host ? `${proto}://${host}` : null;
  const origin = process.env.NEXT_PUBLIC_APP_URL || originFromReq || "";

  // Best-effort server metadata. If service account isn't configured locally, fall back safely.
  try {
    const [site, itemSnap] = await Promise.all([
      getSiteConfigServer(),
      getAdminDb().doc(`items/${itemId}`).get(),
    ]);

    const item = itemSnap.exists ? (itemSnap.data() as any) : null;
    const title = item?.title ? `${item.title} — ${site.eventTitle}` : site.eventTitle;
    const description = site.orgName
      ? `Place your bid now. Every bid supports ${site.orgName}.`
      : "Place your bid now.";
    const image = item?.photoUrls?.[0];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : undefined,
        url: origin ? `${origin}/items/${itemId}` : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    const site = await getSiteConfigServer();
    return {
      title: site.eventTitle,
      description: site.orgName ? `A charity silent auction by ${site.orgName}.` : undefined,
    };
  }
}

export default function ItemPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <ItemClient />
    </Suspense>
  );
}

