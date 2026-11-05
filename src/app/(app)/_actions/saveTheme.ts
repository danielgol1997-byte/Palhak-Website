"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { mergeTuning } from "@/lib/theme-tuning";
import { CUSTOM_PRESET_ID, THEME_EFFECTS, THEME_PRESETS } from "@/lib/theme";

export async function saveThemeAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.THEME_MASTER) {
    return { success: false, error: "אין הרשאה" };
  }

  const presetRaw = (formData.get("preset") as string) ?? "default";
  const effectRaw = (formData.get("effect") as string) ?? "none";
  const preset =
    presetRaw === CUSTOM_PRESET_ID || THEME_PRESETS.some((p) => p.id === presetRaw) ? presetRaw : "default";
  const effect = THEME_EFFECTS.some((e) => e.id === effectRaw) ? effectRaw : "none";
  const tuningRaw = formData.get("tuning");
  let tuning = mergeTuning(undefined);
  if (typeof tuningRaw === "string" && tuningRaw.trim()) {
    try {
      tuning = mergeTuning(JSON.parse(tuningRaw));
    } catch {
      return { success: false, error: "נתוני עיצוב לא תקינים" };
    }
  }

  const tuningJson = JSON.parse(JSON.stringify(tuning)) as Prisma.InputJsonValue;

  await prisma.siteTheme.upsert({
    where: { id: "singleton" },
    update: { preset, effect, tuning: tuningJson },
    create: { id: "singleton", preset, effect, tuning: tuningJson },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
