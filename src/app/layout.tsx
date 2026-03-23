import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, buildThemeVarScript } from "@/lib/theme";

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
  try {
    const theme = await prisma.siteTheme.findUnique({ where: { id: "singleton" } });
    if (theme) {
      presetId = theme.preset;
      effect = theme.effect;
    }
  } catch {
    // DB unavailable — script still applies defaults
  }

  const themeScript = buildThemeVarScript(presetId, effect);

  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
