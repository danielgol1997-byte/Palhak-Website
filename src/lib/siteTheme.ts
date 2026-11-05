import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, mergeTuning, type ThemeTuning } from "@/lib/theme";

export type SiteThemeRow = {
  preset: string;
  effect: string;
  tuningStored: unknown;
  tuning: ThemeTuning;
};

/**
 * One DB read per request, shared by the root layout, the app layout and any
 * page that needs the theme (React `cache` is request-scoped on the server).
 */
export const getSiteTheme = cache(async (): Promise<SiteThemeRow> => {
  try {
    const row = await prisma.siteTheme.findUnique({ where: { id: "singleton" } });
    if (row) {
      return {
        preset: row.preset,
        effect: row.effect,
        tuningStored: row.tuning ?? undefined,
        tuning: mergeTuning(row.tuning),
      };
    }
  } catch {
    // DB unavailable: defaults keep the UI usable
  }
  return {
    preset: DEFAULT_THEME.preset,
    effect: DEFAULT_THEME.effect,
    tuningStored: undefined,
    tuning: DEFAULT_THEME.tuning,
  };
});
