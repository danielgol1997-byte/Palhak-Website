import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getSiteTheme } from "@/lib/siteTheme";
import { buildThemeVarScript, getRootThemeServerSnapshot } from "@/lib/theme";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "אשר",
  description: "מערכת ניהול ציוד מתקדמת",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "אשר" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { preset: presetId, effect, tuningStored } = await getSiteTheme();

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
      {...(themeSnap.saturate ? { "data-theme-saturate": "1" } : {})}
      {...(themeSnap.reduceMotion ? { "data-theme-reduce-motion": "1" } : {})}
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
