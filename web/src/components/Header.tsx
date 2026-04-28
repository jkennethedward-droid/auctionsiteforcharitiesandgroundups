"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { NotificationsMenu } from "@/components/NotificationsMenu";

export function Header() {
  const pathname = usePathname();
  const { site } = useSiteConfig();

  const isToolsPage = pathname.startsWith("/admin") || pathname.startsWith("/staff");

  return (
    <header className="w-full bg-[#0B1F3A] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <a href="/" className="flex items-center gap-3">
          {site?.logoUrl ? (
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
              <Image
                src={site.logoUrl}
                alt="Logo"
                width={80}
                height={80}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/10" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-white">
              {site?.eventTitle || "Silent Auction"}
            </div>
            {site?.orgName ? (
              <div className="truncate text-xs text-white/70">{site.orgName}</div>
            ) : null}
          </div>
        </a>

        <div className="flex shrink-0 items-center gap-2">
          {!isToolsPage ? <NotificationsMenu /> : null}
        </div>
      </div>
    </header>
  );
}

