import Link from "next/link";
import type { ReactNode } from "react";

/** Flat, full-width tappable card for phones (the 3D tilt cards stay on desktop). */
export function MobileTile({
  href,
  title,
  subtitle,
  icon,
  badge,
}: {
  href: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.75rem] items-center gap-4 rounded-2xl border p-4 shadow-lg transition active:scale-[0.985]"
      style={{
        background: "color-mix(in srgb, var(--t-surface, #18181b) 92%, var(--t-accent) 8%)",
        borderColor: "color-mix(in srgb, var(--t-border, #27272a) 80%, var(--t-accent) 20%)",
        color: "var(--t-fg, #fafafa)",
      }}
    >
      {icon && (
        <div
          className="theme-3d-card-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl [&>svg]:h-6 [&>svg]:w-6"
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-black">{title}</div>
        {subtitle && (
          <div className="mt-0.5 line-clamp-2 text-xs leading-snug" style={{ color: "var(--t-fg-muted, #a1a1aa)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180 opacity-50" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}
