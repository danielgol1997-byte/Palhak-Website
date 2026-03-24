"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { mergeTuning } from "@/lib/theme-tuning";

export async function saveThemeAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.THEME_MASTER) {
    return { success: false, error: "אין הרשאה" };
  }

  const preset = (formData.get("preset") as string) ?? "default";
  const effect = (formData.get("effect") as string) ?? "none";
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
