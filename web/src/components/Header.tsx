"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { NotificationsMenu } from "@/components/NotificationsMenu";

export function Header() {
  const pathname = usePathname();
  const { site } = useSiteConfig();

  // Hide on admin/staff pages (they're desktop tools, keep UI clean).
  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return null;

  return (
    <header className="w-full border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <a href="/" className="flex items-center gap-3">
          {site?.logoUrl ? (
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-stone-50">
              <Image
                src={site.logoUrl}
                alt="Logo"
                width={80}
                height={80}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-[#FFF7ED]" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-stone-900">
              {site?.eventTitle || "Silent Auction"}
            </div>
            {site?.orgName ? (
              <div className="truncate text-xs text-stone-500">{site.orgName}</div>
            ) : null}
          </div>
        </a>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationsMenu />
        </div>
      </div>
    </header>
  );
}

