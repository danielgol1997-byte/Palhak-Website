"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function saveThemeAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.THEME_MASTER) {
    return { success: false, error: "אין הרשאה" };
  }

  const preset = (formData.get("preset") as string) ?? "default";
  const effect = (formData.get("effect") as string) ?? "none";

  await prisma.siteTheme.upsert({
    where: { id: "singleton" },
    update: { preset, effect },
    create: { id: "singleton", preset, effect },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
