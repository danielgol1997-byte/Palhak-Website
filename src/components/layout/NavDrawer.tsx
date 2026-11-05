"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { NavIcon } from "./NavIcon";
import { ADMIN_HOME, ADMIN_NAV, PRIMARY_NAV, PRIVILEGED_NAV, isActivePath, type NavItem } from "./nav";

export function NavDrawer({
  open,
  onClose,
  userName,
  userEmail,
  roleLabel,
  isAdmin,
  isPrivileged,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  roleLabel: string;
  isAdmin: boolean;
  isPrivileged: boolean;
  /** Optional extra controls rendered under the user card (e.g. theme studio button). */
  extra?: ReactNode;
}) {
  const pathname = usePathname();

  // Close when navigation happens
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const initials = userName.trim().slice(0, 1) || "א";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true" aria-label="תפריט">
        <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm ui-sheet-fade" onClick={onClose} aria-hidden="true" />
        <nav
          className="ui-drawer-panel absolute inset-y-0 right-0 flex w-[min(86vw,340px)] flex-col border-l shadow-2xl"
          style={{
            background: "var(--t-surface, #18181b)",
            borderColor: "var(--t-border, #27272a)",
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {/* User card */}
          <div className="flex items-center gap-3 border-b px-4 py-4" style={{ borderColor: "var(--t-border, #27272a)" }}>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-lg"
              style={{ backgroundColor: "var(--t-accent, #e4e4e7)", color: "var(--t-bg, #09090b)" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold" style={{ color: "var(--t-fg, #fafafa)" }}>
                {userName}
              </div>
              <div className="truncate text-xs" style={{ color: "var(--t-fg-muted, #a1a1aa)" }}>
                {userEmail}
              </div>
              <div className="mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: "var(--t-border)", color: "var(--t-accent)" }}>
                {roleLabel}
              </div>
            </div>
            <button
              type="button"
              data-view-ok="true"
              onClick={onClose}
              aria-label="סגור תפריט"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-black/10"
              style={{ color: "var(--t-fg-muted)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {extra && <div className="mb-3">{extra}</div>}

            <Section title="ראשי">
              {PRIMARY_NAV.map((item) => (
                <DrawerLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
              ))}
            </Section>

            {isAdmin && (
              <Section title="ניהול">
                <DrawerLink item={ADMIN_HOME} active={isActivePath(pathname, ADMIN_HOME.href)} />
                {ADMIN_NAV.map((item) => (
                  <DrawerLink key={item.href} item={item} active={isActivePath(pathname, item.href)} compact />
                ))}
                {isPrivileged &&
                  PRIVILEGED_NAV.map((item) => (
                    <DrawerLink key={item.href} item={item} active={isActivePath(pathname, item.href)} compact />
                  ))}
              </Section>
            )}
          </div>

          <div className="border-t p-3" style={{ borderColor: "var(--t-border, #27272a)" }}>
            <button
              type="button"
              data-view-ok="true"
              onClick={() => signOut({ callbackUrl: "/auth" })}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition active:scale-[0.98]"
              style={{ borderColor: "var(--t-border)", color: "var(--t-fg)", background: "color-mix(in srgb, var(--t-bg) 40%, transparent)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              יציאה מהמערכת
            </button>
          </div>
        </nav>
      </div>
    </ModalPortal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--t-fg-muted)" }}>
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function DrawerLink({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 transition active:scale-[0.99] ${compact ? "min-h-11 py-2" : "min-h-12 py-2.5"}`}
      style={{
        background: active ? "color-mix(in srgb, var(--t-accent) 16%, transparent)" : "transparent",
        color: active ? "var(--t-accent)" : "var(--t-fg)",
      }}
    >
      <NavIcon name={item.icon} size={compact ? 18 : 22} className="shrink-0 opacity-90" />
      <span className={`min-w-0 flex-1 truncate font-bold ${compact ? "text-sm" : "text-base"}`}>{item.label}</span>
      {active && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--t-accent)" }} />}
    </Link>
  );
}
