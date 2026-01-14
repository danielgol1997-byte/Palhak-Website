"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ClothingSize, ShoeSize } from "@prisma/client";

const OnboardingSchema = z.object({
  firstName: z.string().min(1, "שם פרטי חובה"),
  lastName: z.string().min(1, "שם משפחה חובה"),
  phoneNumber: z.string().regex(/^[0-9]{10}$/, "מספר טלפון לא תקין"),
  personalNumber: z.string().min(1, "מספר אישי חובה"),
  departmentId: z.string().min(1, "מחלקה חובה"),
  positionId: z.string().min(1, "תפקיד חובה"),
  shirtSize: z.nativeEnum(ClothingSize),
  pantsSize: z.nativeEnum(ClothingSize),
  shoeSize: z.nativeEnum(ShoeSize),
  weaponItemId: z.string().min(1, "נשק חובה"),
});

export async function completeOnboardingAction(formData: FormData) {
  try {
    const session = await requireSession();

    // If already onboarded, don't allow re-onboarding
    if (session.user.onboardedAt) {
      return { success: false, error: "המשתמש כבר השלים רישום." };
    }

    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phoneNumber: formData.get("phoneNumber"),
      personalNumber: formData.get("personalNumber"),
      departmentId: formData.get("departmentId"),
      positionId: formData.get("positionId"),
      shirtSize: formData.get("shirtSize"),
      pantsSize: formData.get("pantsSize"),
      shoeSize: formData.get("shoeSize"),
      weaponItemId: formData.get("weaponItemId"),
    };

    const parsed = OnboardingSchema.safeParse(data);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "נתונים לא תקינים.";
      return { success: false, error: firstError };
    }

    // Check if personalNumber is unique
    const existingUser = await prisma.user.findUnique({
      where: { personalNumber: parsed.data.personalNumber },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return { success: false, error: "מספר אישי כבר קיים במערכת." };
    }

    // Update user with onboarding data
    await prisma.$transaction(async (tx) => {
      // Update user basic info
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          name: `${parsed.data.firstName} ${parsed.data.lastName}`,
          phoneNumber: parsed.data.phoneNumber,
          personalNumber: parsed.data.personalNumber,
          shirtSize: parsed.data.shirtSize,
          pantsSize: parsed.data.pantsSize,
          shoeSize: parsed.data.shoeSize,
          weaponItemId: parsed.data.weaponItemId,
          onboardedAt: new Date(),
        },
      });

      // Add department association
      await tx.userDepartment.upsert({
        where: {
          userId_departmentId: {
            userId: session.user.id,
            departmentId: parsed.data.departmentId,
          },
        },
        create: {
          userId: session.user.id,
          departmentId: parsed.data.departmentId,
        },
        update: {},
      });

      // Add position association
      await tx.userPosition.upsert({
        where: {
          userId_positionId: {
            userId: session.user.id,
            positionId: parsed.data.positionId,
          },
        },
        create: {
          userId: session.user.id,
          positionId: parsed.data.positionId,
        },
        update: {},
      });
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Onboarding error:", error);
    return { success: false, error: "אירעה שגיאה. נסה שוב." };
  }
}

