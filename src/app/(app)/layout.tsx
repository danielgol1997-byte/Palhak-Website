import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { hasAtLeastRole, isPrivilegedOperator } from "@/lib/rbac";
import { ViewOnlyGuard } from "@/components/ViewOnlyGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileTableEnhancer } from "@/components/ui/MobileTableEnhancer";
import { roleLabelHe } from "@/components/layout/nav";
import { AdminNotificationBell } from "./admin/_components/AdminNotificationBell";
import { ThemeDesigner } from "./_components/ThemeDesigner";
import { ThemeEffects } from "./_components/ThemeEffects";
import { getSiteTheme } from "@/lib/siteTheme";
import { getResolvedPreset } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, theme] = await Promise.all([getSession(), getSiteTheme()]);
  const role = session?.user?.role as Role | undefined;
  const isAdmin = role ? hasAtLeastRole(role, Role.ADMIN) : false;
  const isViewOnly = role === Role.VIEW_ONLY;
  const isThemeMaster = role === Role.THEME_MASTER;
  const isPrivileged = role ? isPrivilegedOperator(role) : false;
  const preset = getResolvedPreset(theme.preset, theme.tuningStored);

  return (
    <div
      className="app-theme-scope relative min-h-dvh transition-colors duration-700"
      style={{ backgroundColor: "var(--t-bg, #09090b)", color: "var(--t-fg, #fafafa)" }}
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
      {/* Background photo: small WebP on phones, larger on desktop (was a 3.6 MB JPEG) */}
      <div
        className="theme-bg-photo pointer-events-none fixed inset-0 -z-20 bg-cover bg-center grayscale-[0.12] contrast-90 saturate-90 transition-opacity duration-700"
        style={{ opacity: "var(--t-photo-opacity, 0.25)" }}
        aria-hidden="true"
      />
      {/* Atmosphere vignette */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-all duration-700"
        style={{ background: "var(--t-vignette)" }}
        aria-hidden="true"
      />
      <div className="theme-grain-layer" aria-hidden />

      <ThemeEffects initialEffect={theme.effect} initialPreset={theme.preset} initialTuning={theme.tuningStored} />

      <AppHeader
        userName={session?.user?.name ?? ""}
        userEmail={session?.user?.email ?? ""}
        roleLabel={roleLabelHe(role)}
        isAdmin={isAdmin}
        isPrivileged={isPrivileged}
        accent={preset.accent}
        bell={isAdmin ? <AdminNotificationBell /> : undefined}
        themeDesigner={
          isThemeMaster ? (
            <ThemeDesigner initialPreset={theme.preset} initialEffect={theme.effect} initialTuning={theme.tuning} />
          ) : undefined
        }
      />

      <main className="app-main mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-3 py-4 sm:px-4 sm:py-6">
        {isViewOnly ? <ViewOnlyGuard>{children}</ViewOnlyGuard> : children}
      </main>

      <MobileTableEnhancer />
    </div>
  );
}
