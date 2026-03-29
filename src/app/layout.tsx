import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, buildThemeVarScript, getRootThemeServerSnapshot } from "@/lib/theme";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "אשר",
  description: "מערכת ניהול ציוד מתקדמת",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let presetId = DEFAULT_THEME.preset;
  let effect = DEFAULT_THEME.effect;
  let tuningStored: unknown = undefined;
  try {
    const theme = await prisma.siteTheme.findUnique({ where: { id: "singleton" } });
    if (theme) {
      presetId = theme.preset;
      effect = theme.effect;
      tuningStored = theme.tuning ?? undefined;
    }
  } catch {
    // DB unavailable — script still applies defaults
  }

  const themeScript = buildThemeVarScript(presetId, effect, tuningStored);
  const themeSnap = getRootThemeServerSnapshot(presetId, effect, tuningStored);

  return (
    <html
      lang="he"
      dir="rtl"
      style={themeSnap.htmlStyle as CSSProperties}
      data-theme-mode={themeSnap.mode}
      data-effect={themeSnap.effect}
      {...(themeSnap.hasImmersive ? { "data-immersive": "1" } : {})}
      {...(themeSnap.cardFloat ? { "data-theme-card-float": "1" } : {})}
      {...(themeSnap.cardWiggle ? { "data-theme-card-wiggle": "1" } : {})}
    >
      <body
        className={`${heebo.variable} antialiased`}
        style={{ backgroundColor: themeSnap.bodyStyle.backgroundColor }}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
