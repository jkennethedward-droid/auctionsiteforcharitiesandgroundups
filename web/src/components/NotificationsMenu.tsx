"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import {
  markAllNotificationsRead,
  recentNotificationsQuery,
  type NotificationRow,
  unreadNotificationsQuery,
} from "@/lib/notifications";

export function NotificationsMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationRow[]>([]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setRecent([]);
      return;
    }

    const unsubUnread = onSnapshot(unreadNotificationsQuery(user.uid), (snap) => {
      setUnreadCount(snap.size);
    });
    const unsubRecent = onSnapshot(recentNotificationsQuery(user.uid), (snap) => {
      setRecent(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })),
      );
    });

    return () => {
      unsubUnread();
      unsubRecent();
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    if (!user) return;
    void markAllNotificationsRead(user.uid);
  }, [open, user]);

  const label = useMemo(() => {
    if (loading) return "…";
    if (!user) return "Sign in";
    return `Notifications${unreadCount ? ` (${unreadCount})` : ""}`;
  }, [loading, unreadCount, user]);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 items-center justify-center rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-900 hover:bg-stone-50"
        aria-label={label}
      >
        <span className="text-sm">Notifications</span>
        {unreadCount ? (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#F97316] px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">
            Notifications
          </div>
          <div className="max-h-96 overflow-auto">
            {recent.length ? (
              recent.map((n) => (
                <a
                  key={n.id}
                  href={`/items/${n.itemId}`}
                  className="block border-b border-stone-100 px-4 py-3 hover:bg-stone-50"
                  onClick={() => setOpen(false)}
                >
                  <div className="text-sm font-semibold">{n.itemTitle}</div>
                  <div className="mt-1 text-sm text-stone-700">
                    New highest bid: <span className="font-semibold">${Number(n.newHighestBid).toFixed(0)}</span>
                  </div>
                  {!n.read ? (
                    <div className="mt-2 text-xs font-semibold text-[#F97316]">Unread</div>
                  ) : (
                    <div className="mt-2 text-xs text-stone-500">Read</div>
                  )}
                </a>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-stone-600">No notifications yet.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

