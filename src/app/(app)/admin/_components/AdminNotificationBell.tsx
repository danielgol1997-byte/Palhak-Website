"use client";

import { useState, useEffect, useRef } from "react";
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
      return "border-l-4 border-l-blue-500 hover:bg-blue-950/20";
    case "RETURN_EQUIPMENT":
      return "border-l-4 border-l-purple-500 hover:bg-purple-950/20";
    case "DAMAGED":
      return "border-l-4 border-l-yellow-500 hover:bg-yellow-950/20";
    case "STOLEN":
      return "border-l-4 border-l-red-500 hover:bg-red-950/20";
    case "MISSING":
      return "border-l-4 border-l-zinc-500 hover:bg-zinc-800/20";
    case "USED":
      return "border-l-4 border-l-orange-500 hover:bg-orange-950/20";
    case "TRANSFER":
      return "border-l-4 border-l-green-500 hover:bg-green-950/20";
    default:
      return "border-l-4 border-l-zinc-500 hover:bg-zinc-800/20";
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

export function AdminNotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll for new notifications every 5 seconds
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/admin/notifications");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnviewedCount(data.unviewedCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);

    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleDropdown = async () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    // Mark all notifications as viewed when opening
    if (newIsOpen && unviewedCount > 0) {
      try {
        await fetch("/api/admin/notifications/mark-viewed", {
          method: "POST",
        });
        setUnviewedCount(0);
      } catch (error) {
        console.error("Failed to mark notifications as viewed", error);
      }
    }
  };

  const dismissNotification = async (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await fetch("/api/admin/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Failed to dismiss notification", error);
    }
  };

  const clearAll = async () => {
    setIsClearing(true);
    try {
      await fetch("/api/admin/notifications/dismiss-all", {
        method: "POST",
      });
      setNotifications([]);
      setUnviewedCount(0);
    } catch (error) {
      console.error("Failed to clear all notifications", error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={handleToggleDropdown}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-50"
        aria-label="התראות"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Notification Badge */}
        {unviewedCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unviewedCount > 99 ? "99+" : unviewedCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-screen max-w-md sm:w-96 rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-bold text-zinc-50">התראות</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                disabled={isClearing}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? "מנקה..." : "נקה הכל"}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-12 w-12 text-zinc-700 mb-3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-zinc-500 font-medium">אין התראות חדשות</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href="/admin/requests"
                  className={`block px-4 py-3 transition-colors ${getRequestTypeColor(
                    notification.requestType
                  )}`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p
                          className={`text-xs font-bold ${getRequestTypeTextColor(
                            notification.requestType
                          )}`}
                        >
                          {requestTypeLabel(notification.requestType as RequestType)}
                        </p>
                        <span className="text-xs text-zinc-500">•</span>
                        <p className="text-xs text-zinc-500">
                          {new Date(notification.createdAt).toLocaleString("he-IL", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-zinc-50 mb-1">
                        {notification.requesterName}
                      </p>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {notification.itemsSummary}
                      </p>
                    </div>
                    <button
                      onClick={(e) => dismissNotification(notification.id, e)}
                      className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-700 transition-all"
                      aria-label="סגור"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
