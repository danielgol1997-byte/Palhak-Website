"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RequestType } from "@prisma/client";
import { requestTypeLabel } from "@/lib/he";
import { Sheet } from "@/components/ui/Sheet";
import { useIsMobile } from "@/hooks/useMediaQuery";

interface Notification {
  id: string;
  requestId: string;
  requestType: string;
  requesterName: string;
  itemsSummary: string;
  createdAt: string;
  viewed: boolean;
}

const TYPE_STYLE: Record<string, { bar: string; text: string }> = {
  NEW_EQUIPMENT: { bar: "bg-blue-500", text: "text-blue-400" },
  RETURN_EQUIPMENT: { bar: "bg-purple-500", text: "text-purple-400" },
  DAMAGED: { bar: "bg-yellow-500", text: "text-yellow-400" },
  STOLEN: { bar: "bg-red-500", text: "text-red-400" },
  MISSING: { bar: "bg-zinc-500", text: "text-zinc-400" },
  USED: { bar: "bg-orange-500", text: "text-orange-400" },
  TRANSFER: { bar: "bg-green-500", text: "text-green-400" },
};

/** Poll cadence. Visible tab: 30s. Hidden tab: paused. Open panel: 15s. */
const POLL_MS = 30_000;
const POLL_OPEN_MS = 15_000;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

export function AdminNotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications?count=1", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { unviewedCount: number };
        setUnviewedCount(data.unviewedCount ?? 0);
      }
    } catch {
      /* offline: keep last value */
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: Notification[]; unviewedCount: number };
        setNotifications(data.notifications ?? []);
        setUnviewedCount(data.unviewedCount ?? 0);
        setLoaded(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Polling: light count endpoint when closed, full list when open; paused while hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => (isOpen ? fetchAll() : fetchCount());
    const start = () => {
      if (timer) clearInterval(timer);
      tick();
      timer = setInterval(tick, isOpen ? POLL_OPEN_MS : POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", tick);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", tick);
    };
  }, [isOpen, fetchAll, fetchCount]);

  // Desktop popover: close on outside click
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, isMobile]);

  const open = async () => {
    setIsOpen(true);
    await fetchAll();
    if (unviewedCount > 0) {
      try {
        await fetch("/api/admin/notifications/mark-viewed", { method: "POST" });
        setUnviewedCount(0);
      } catch {
        /* ignore */
      }
    }
  };

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch("/api/admin/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {
      /* ignore */
    }
  };

  const clearAll = async () => {
    setIsClearing(true);
    try {
      await fetch("/api/admin/notifications/dismiss-all", { method: "POST" });
      setNotifications([]);
      setUnviewedCount(0);
    } finally {
      setIsClearing(false);
    }
  };

  const list = (
    <div className="flex flex-col">
      {!loaded ? (
        <div className="py-10 text-center text-sm text-zinc-500">טוען…</div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mb-3 h-12 w-12 text-zinc-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-zinc-500">אין התראות חדשות</p>
        </div>
      ) : (
        notifications.map((n) => {
          const st = TYPE_STYLE[n.requestType] ?? TYPE_STYLE.MISSING;
          return (
            <Link
              key={n.id}
              href="/admin/requests"
              onClick={() => setIsOpen(false)}
              className="relative flex items-start gap-3 border-b border-zinc-800/70 px-4 py-3 transition hover:bg-zinc-800/40 active:bg-zinc-800/60"
            >
              <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${st.bar}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2 text-xs">
                  <span className={`font-bold ${st.text}`}>{requestTypeLabel(n.requestType as RequestType)}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500">{fmt(n.createdAt)}</span>
                  {!n.viewed && <span className="ms-auto h-2 w-2 rounded-full bg-red-500" aria-label="חדש" />}
                </div>
                <p className="text-sm font-bold text-zinc-50">{n.requesterName}</p>
                <p className="line-clamp-2 text-xs text-zinc-400">{n.itemsSummary}</p>
              </div>
              <button
                type="button"
                onClick={(e) => dismiss(n.id, e)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-50"
                aria-label="הסר התראה"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Link>
          );
        })
      )}
    </div>
  );

  const clearBtn = notifications.length > 0 && (
    <button
      type="button"
      data-write="true"
      onClick={clearAll}
      disabled={isClearing}
      className="text-xs font-bold text-zinc-400 transition hover:text-zinc-50 disabled:opacity-50"
    >
      {isClearing ? "מנקה…" : "נקה הכל"}
    </button>
  );

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        data-view-ok="true"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border transition hover:scale-105 active:scale-95"
        style={{
          borderColor: "var(--t-border, #27272a)",
          background: "color-mix(in srgb, var(--t-bg) 35%, transparent)",
          color: unviewedCount > 0 ? "var(--t-fg)" : "var(--t-fg-muted)",
        }}
        aria-label={unviewedCount > 0 ? `התראות (${unviewedCount} חדשות)` : "התראות"}
        aria-expanded={isOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unviewedCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow">
            {unviewedCount > 99 ? "99+" : unviewedCount}
          </span>
        )}
      </button>

      {/* Mobile: full bottom sheet */}
      {isMobile && (
        <Sheet open={isOpen} onClose={() => setIsOpen(false)} title="התראות" size="md" headerExtra={<div className="mt-1">{clearBtn}</div>} bodyClassName="!px-0 !py-0">
          {list}
        </Sheet>
      )}

      {/* Desktop: anchored popover, kept inside the viewport */}
      {!isMobile && isOpen && (
        <div
          className="absolute top-full z-50 mt-2 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          style={{ insetInlineEnd: 0 }}
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-bold text-zinc-50">התראות</h3>
            {clearBtn}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">{list}</div>
        </div>
      )}
    </div>
  );
}
