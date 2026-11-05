"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./NavIcon";
import { ADMIN_HOME, PRIMARY_NAV, isActivePath } from "./nav";

export function MobileBottomNav({ isAdmin, onOpenMenu }: { isAdmin: boolean; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const items = isAdmin ? [...PRIMARY_NAV, ADMIN_HOME] : PRIMARY_NAV;

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
      style={{
        borderColor: "var(--t-border, #27272a)",
        background: "color-mix(in srgb, var(--t-surface, #18181b) 88%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="ניווט ראשי"
    >
      <div className="mx-auto grid h-16 max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex min-w-0 flex-col items-center justify-center gap-1 transition active:scale-95"
              style={{ color: active ? "var(--t-accent, #e4e4e7)" : "var(--t-fg-muted, #a1a1aa)" }}
            >
              <span
                className="flex h-7 w-12 items-center justify-center rounded-full transition"
                style={{ background: active ? "color-mix(in srgb, var(--t-accent) 18%, transparent)" : "transparent" }}
              >
                <NavIcon name={item.icon} size={20} />
              </span>
              <span className="max-w-full truncate text-[11px] font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          data-view-ok="true"
          onClick={onOpenMenu}
          className="flex min-w-0 flex-col items-center justify-center gap-1 transition active:scale-95"
          style={{ color: "var(--t-fg-muted, #a1a1aa)" }}
          aria-label="תפריט"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          <span className="text-[11px] font-bold leading-none">תפריט</span>
        </button>
      </div>
    </nav>
  );
}
