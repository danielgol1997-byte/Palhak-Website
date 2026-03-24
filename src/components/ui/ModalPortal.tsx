"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body so position:fixed overlays are tied to the
 * viewport, not a transformed/filtered ancestor (e.g. .app-theme-scope uses
 * filter:saturate, which breaks fixed positioning inside the app shell).
 */
let scrollLockCount = 0;

function lockBodyScroll() {
  scrollLockCount++;
  if (scrollLockCount === 1) {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }
}

export function ModalPortal({
  children,
  lockScroll = true,
}: {
  children: ReactNode;
  /** Set false for lightweight prompts that should not lock the page (rare). */
  lockScroll?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !lockScroll) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [mounted, lockScroll]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-portal-root"
      dir="rtl"
      style={{ color: "var(--t-fg, #fafafa)" }}
    >
      {children}
    </div>,
    document.body,
  );
}
