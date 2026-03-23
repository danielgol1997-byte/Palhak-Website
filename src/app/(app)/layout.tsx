import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { Role } from "@prisma/client";
import { BackButton } from "@/components/BackButton";
import { AdminNotificationBell } from "./admin/_components/AdminNotificationBell";
import { ThemeDesigner } from "./_components/ThemeDesigner";
import { ThemeEffects } from "./_components/ThemeEffects";
import { prisma } from "@/lib/prisma";
import { getResolvedPreset, DEFAULT_THEME } from "@/lib/theme";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as Role | undefined;
  const isAdmin =
    role === Role.ADMIN || role === Role.SUPER_ADMIN || role === Role.THEME_MASTER;
  const isThemeMaster = role === Role.THEME_MASTER;

  let themePreset = DEFAULT_THEME.preset;
  let themeEffect = DEFAULT_THEME.effect;
  try {
    const theme = await prisma.siteTheme.findUnique({ where: { id: "singleton" } });
    if (theme) {
      themePreset = theme.preset;
      themeEffect = theme.effect;
    }
  } catch {
    // use defaults
  }

  const preset = getResolvedPreset(themePreset);

  return (
    <div
      className="app-theme-scope relative min-h-dvh transition-colors duration-700"
      style={{
        backgroundColor: "var(--t-bg, #09090b)",
        color: "var(--t-fg, #fafafa)",
      }}
    >
      {/* Immersive animated gradient (girly / light themes) */}
      <div
        className="yuval-immersive-layer pointer-events-none absolute inset-0 -z-30 transition-opacity duration-700"
        style={{ background: "var(--t-immersive, transparent)" }}
        aria-hidden="true"
      />
      {/* Theme-colored overlay tint */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-colors duration-700"
        style={{ backgroundColor: "var(--t-overlay, transparent)" }}
        aria-hidden="true"
      />
      {/* Background image layer */}
      <div
        className="theme-bg-photo pointer-events-none absolute inset-0 -z-20 bg-cover bg-center grayscale-[0.12] contrast-90 saturate-90 transition-opacity duration-700"
        style={{
          backgroundImage: "url(/bg.jpg)",
          opacity: "var(--t-photo-opacity, 0.25)",
        }}
        aria-hidden="true"
      />
      {/* Atmosphere vignette (dark or soft pink for light) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-all duration-700"
        style={{ background: "var(--t-vignette)" }}
        aria-hidden="true"
      />

      {/* Animated effects overlay (stars, sparkles, aurora…) */}
      <ThemeEffects initialEffect={themeEffect} initialPreset={themePreset} />

      <header
        className="sticky top-0 z-20 border-b backdrop-blur transition-colors duration-700"
        style={{
          borderColor: "var(--t-border, #27272a)",
          background: `color-mix(in srgb, var(--t-surface, #18181b) 85%, transparent)`,
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-3 group transition-all">
              <div className="relative">
                <div
                  className="absolute -inset-1 rounded-xl opacity-0 blur transition duration-500 group-hover:opacity-100"
                  style={{ backgroundColor: "var(--t-glow, rgba(255,255,255,0.08))" }}
                />
                <div
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl shadow-xl transition-all duration-300 group-hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: "var(--t-accent, #e4e4e7)",
                    color: "var(--t-bg, #09090b)",
                  }}
                >
                  <span className="text-2xl font-black leading-none select-none">א</span>
                </div>
              </div>
              <div className="flex flex-col -space-y-1.5 min-w-0">
                <span
                  className="text-2xl font-black tracking-tighter select-none"
                  style={{ color: "var(--t-fg, #fafafa)" }}
                >
                  אשר
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.2em] select-none truncate transition-colors duration-700"
                  style={{ color: preset.accent }}
                >
                  INVENTORY
                </span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:block text-sm font-medium"
              style={{ color: "var(--t-fg-muted, #a1a1aa)" }}
            >
              {session?.user?.name ?? ""}
            </div>
            {isAdmin && <AdminNotificationBell />}
            {isThemeMaster && (
              <ThemeDesigner initialPreset={themePreset} initialEffect={themeEffect} />
            )}
            <SignOutButton />
            <BackButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-24">
        {children}
      </main>
    </div>
  );
}
