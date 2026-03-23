import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME } from "@/lib/theme";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const theme = await prisma.siteTheme.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({
      preset: theme?.preset ?? DEFAULT_THEME.preset,
      effect: theme?.effect ?? DEFAULT_THEME.effect,
    });
  } catch {
    return NextResponse.json(DEFAULT_THEME);
  }
}
