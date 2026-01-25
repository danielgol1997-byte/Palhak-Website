"use client";

import { useState, useEffect } from "react";
import { RequestType } from "@prisma/client";
import { requestTypeLabel } from "@/lib/he";
import Link from "next/link";

interface Notification {
  id: string;
  requestId: string;
  requestType: string;
  requesterName: string;
  itemsSummary: string;
  createdAt: string;
}

function getRequestTypeColor(type: string): string {
  switch (type) {
    case "NEW_EQUIPMENT":
      return "border-blue-500 bg-blue-950/30";
    case "RETURN_EQUIPMENT":
      return "border-purple-500 bg-purple-950/30";
    case "DAMAGED":
      return "border-yellow-500 bg-yellow-950/30";
    case "STOLEN":
      return "border-red-500 bg-red-950/30";
    case "MISSING":
      return "border-zinc-500 bg-zinc-900/30";
    case "USED":
      return "border-orange-500 bg-orange-950/30";
    case "TRANSFER":
      return "border-green-500 bg-green-950/30";
    default:
      return "border-zinc-500 bg-zinc-900/30";
  }
}

function getRequestTypeTextColor(type: string): string {
  switch (type) {
    case "NEW_EQUIPMENT":
      return "text-blue-400";
    case "RETURN_EQUIPMENT":
      return "text-purple-400";
    case "DAMAGED":
      return "text-yellow-400";
    case "STOLEN":
      return "text-red-400";
    case "MISSING":
      return "text-zinc-400";
    case "USED":
      return "text-orange-400";
    case "TRANSFER":
      return "text-green-400";
    default:
      return "text-zinc-400";
  }
}

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load dismissed IDs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("dismissedNotifications");
    if (stored) {
      try {
        setDismissedIds(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error("Failed to parse dismissed notifications", e);
      }
    }
  }, []);

  // Poll for new notifications every 5 seconds
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/admin/notifications");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);

    return () => clearInterval(interval);
  }, []);

  const dismissNotification = async (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedNotifications", JSON.stringify([...newDismissed]));

    // Mark as dismissed in the database
    try {
      await fetch("/api/admin/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (error) {
      console.error("Failed to dismiss notification", error);
    }
  };

  const clearAll = async () => {
    setIsLoading(true);
    try {
      const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));
      const idsToRemove = visibleNotifications.map((n) => n.id);
      
      const newDismissed = new Set(dismissedIds);
      idsToRemove.forEach((id) => newDismissed.add(id));
      setDismissedIds(newDismissed);
      localStorage.setItem("dismissedNotifications", JSON.stringify([...newDismissed]));

      // Mark all as dismissed in the database
      await fetch("/api/admin/notifications/dismiss-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: idsToRemove }),
      });
    } catch (error) {
      console.error("Failed to clear all notifications", error);
    } finally {
      setIsLoading(false);
      setShowClearAllConfirm(false);
    }
  };

  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 flex flex-col gap-3 max-w-sm sm:max-w-md pointer-events-none">
      {/* Clear All Button */}
      {visibleNotifications.length > 0 && (
        <div className="pointer-events-auto flex justify-end">
          {!showClearAllConfirm ? (
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-50 bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all shadow-lg"
            >
              נקה הכל
            </button>
          ) : (
            <div className="flex gap-2 bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-800 shadow-lg p-2">
              <button
                onClick={clearAll}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-bold text-red-400 hover:text-red-300 bg-red-950/50 hover:bg-red-950/70 rounded-lg border border-red-800 hover:border-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "מנקה..." : "אישור"}
              </button>
              <button
                onClick={() => setShowClearAllConfirm(false)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800/70 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ביטול
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto relative rounded-lg border-2 shadow-xl backdrop-blur p-4 animate-in slide-in-from-right duration-300 ${getRequestTypeColor(
            notification.requestType
          )}`}
        >
          <button
            onClick={() => dismissNotification(notification.id)}
            className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/50 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-950/80 transition-all"
            aria-label="סגור"
          >
            ×
          </button>

          <Link href="/admin/requests" className="block">
            <div className="pr-8">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p
                    className={`text-sm font-bold ${getRequestTypeTextColor(
                      notification.requestType
                    )}`}
                  >
                    {requestTypeLabel(notification.requestType as RequestType)}
                  </p>
                  <p className="text-base font-bold text-zinc-50 mt-0.5">
                    {notification.requesterName}
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-300 line-clamp-2">
                {notification.itemsSummary}
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                {new Date(notification.createdAt).toLocaleString("he-IL", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </p>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
