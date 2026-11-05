"use client";

import { useEffect, useId, type ReactNode } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";

type Size = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<Size, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[min(96vw,1200px)]",
};

/**
 * Responsive dialog. On phones it is a bottom sheet that never exceeds the
 * visible viewport (dvh) and keeps its header and footer pinned; on larger
 * screens it is a centered modal. Body scrolls internally.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  dismissible = true,
  zIndex = 200,
  bodyClassName = "",
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: Size;
  dismissible?: boolean;
  zIndex?: number;
  bodyClassName?: string;
  headerExtra?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="ui-sheet-overlay fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
        style={{ zIndex }}
        role="presentation"
      >
        <div
          className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm ui-sheet-fade"
          onClick={dismissible ? onClose : undefined}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className={`ui-sheet-panel relative flex w-full flex-col overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl
            max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] rounded-t-3xl
            sm:max-h-[min(90dvh,900px)] sm:rounded-3xl ${SIZE_CLASS[size]}`}
        >
          {/* drag handle (mobile only) */}
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span className="h-1.5 w-12 rounded-full bg-zinc-700" />
          </div>

          {(title || dismissible) && (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 id={titleId} className="truncate text-lg font-bold text-zinc-50 sm:text-xl">
                    {title}
                  </h2>
                )}
                {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
                {headerExtra}
              </div>
              {dismissible && (
                <button
                  type="button"
                  data-view-ok="true"
                  onClick={onClose}
                  aria-label="סגור"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 ${bodyClassName}`}>
            {children}
          </div>

          {footer && (
            <div
              className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

/** Standard footer: primary action on the start side (RTL: right), secondary beside it. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">{children}</div>;
}
