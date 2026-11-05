"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { NavDrawer } from "./NavDrawer";
import { MobileBottomNav } from "./MobileBottomNav";
import { ADMIN_HOME, PRIMARY_NAV, isActivePath } from "./nav";

export function AppHeader({
  userName,
  userEmail,
  roleLabel,
  isAdmin,
  isPrivileged,
  accent,
  bell,
  themeDesigner,
}: {
  userName: string;
  userEmail: string;
  roleLabel: string;
  isAdmin: boolean;
  isPrivileged: boolean;
  accent: string;
  bell?: ReactNode;
  themeDesigner?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/me" || pathname === "/";

  const goBack = () => {
    if (pathname.startsWith("/admin/")) router.push("/admin");
    else router.push("/me");
  };

  const navItems = isAdmin ? [...PRIMARY_NAV, ADMIN_HOME] : PRIMARY_NAV;

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl transition-colors duration-700"
        style={{
          borderColor: "var(--t-border, #27272a)",
          background: "color-mix(in srgb, var(--t-surface, #18181b) 85%, transparent)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          {/* Hamburger (mobile) */}
          <button
            type="button"
            data-view-ok="true"
            onClick={() => setMenuOpen(true)}
            aria-label="פתח תפריט"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition active:scale-95 md:hidden"
            style={{ color: "var(--t-fg, #fafafa)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Brand */}
          <Link href="/me" className="group flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label="דף הבית">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-1 rounded-xl opacity-0 blur transition duration-500 group-hover:opacity-100"
                style={{ backgroundColor: "var(--t-glow, rgba(255,255,255,0.08))" }}
              />
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-xl shadow-xl transition-all duration-300 group-hover:scale-105 group-active:scale-95 sm:h-10 sm:w-10"
                style={{ backgroundColor: "var(--t-accent, #e4e4e7)", color: "var(--t-bg, #09090b)" }}
              >
                <span className="select-none text-xl font-black leading-none sm:text-2xl">א</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col -space-y-1">
              <span className="select-none text-xl font-black tracking-tighter sm:text-2xl" style={{ color: "var(--t-fg, #fafafa)" }}>
                אשר
              </span>
              <span className="select-none truncate text-[9px] font-bold uppercase tracking-[0.2em] sm:text-[10px]" style={{ color: accent }}>
                INVENTORY
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="mx-4 hidden min-w-0 flex-1 items-center gap-1 md:flex" aria-label="ניווט ראשי">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="rounded-xl px-3.5 py-2 text-sm font-bold transition hover:bg-black/10"
                  style={{
                    color: active ? "var(--t-accent)" : "var(--t-fg-muted)",
                    background: active ? "color-mix(in srgb, var(--t-accent) 14%, transparent)" : undefined,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <div className="hidden max-w-[12rem] truncate text-sm font-medium lg:block" style={{ color: "var(--t-fg-muted, #a1a1aa)" }}>
              {userName}
            </div>
            {bell}
            {themeDesigner}
            <button
              type="button"
              data-view-ok="true"
              onClick={() => signOut({ callbackUrl: "/auth" })}
              className="hidden h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition hover:scale-105 active:scale-95 md:inline-flex"
              style={{ borderColor: "var(--t-border)", color: "var(--t-fg)", background: "color-mix(in srgb, var(--t-bg) 35%, transparent)" }}
            >
              יציאה
            </button>
            {!isHome && (
              <button
                type="button"
                data-view-ok="true"
                onClick={goBack}
                aria-label="חזרה"
                className="flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90"
                style={{ background: "color-mix(in srgb, var(--t-fg) 10%, transparent)", color: "var(--t-fg-muted)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <NavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        userEmail={userEmail}
        roleLabel={roleLabel}
        isAdmin={isAdmin}
        isPrivileged={isPrivileged}
      />
      <MobileBottomNav isAdmin={isAdmin} onOpenMenu={() => setMenuOpen(true)} />
    </>
  );
}
