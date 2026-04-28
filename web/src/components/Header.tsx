"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { useAuth } from "@/components/AuthProvider";
import { getRoleClaim } from "@/lib/claims";
import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function Header() {
  const pathname = usePathname();
  const { site } = useSiteConfig();
  const { user } = useAuth();
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isToolsPage = pathname.startsWith("/admin") || pathname.startsWith("/staff");

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      setMenuOpen(false);
      return;
    }
    // Force refresh so we never show admin link from stale claims.
    getRoleClaim(user, true)
      .then((r) => {
        if (!cancelled) setRole(r);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menuOpen) return;
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

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
          {role === "admin" ? (
            <a
              href="/admin/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10"
            >
              Admin dashboard
            </a>
          ) : null}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white hover:bg-white/10"
                aria-label="Profile menu"
                aria-expanded={menuOpen}
                title="Profile"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0B1F3A] shadow-lg ring-1 ring-black/20">
                  <div className="px-3 py-2 text-xs text-white/70">
                    <div className="truncate font-semibold text-white/90">
                      {user.displayName || user.email || "Signed in"}
                    </div>
                    {user.email ? <div className="truncate">{user.email}</div> : null}
                  </div>
                  <div className="h-px bg-white/10" />
                  <a
                    href="/profile"
                    className="block px-3 py-2 text-sm text-white hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </a>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        const auth = getFirebaseAuth();
                        await signOut(auth);
                      } finally {
                        window.location.href = "/";
                      }
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {!isToolsPage ? <NotificationsMenu /> : null}
        </div>
      </div>
    </header>
  );
}

