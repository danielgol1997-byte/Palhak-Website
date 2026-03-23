import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { prisma } from "@/lib/prisma";
import { getPreset, DEFAULT_THEME, buildThemeVarScript } from "@/lib/theme";

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
  let themeScript = "";
  try {
    const theme = await prisma.siteTheme.findUnique({ where: { id: "singleton" } });
    if (theme && theme.preset !== DEFAULT_THEME.preset) {
      const preset = getPreset(theme.preset);
      themeScript = buildThemeVarScript(preset, theme.effect);
    }
  } catch {
    // DB unavailable — use CSS defaults
  }

  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} antialiased`}>
        {themeScript && (
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
