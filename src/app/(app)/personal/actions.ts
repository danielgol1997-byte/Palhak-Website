"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ClothingSize, ShoeSize } from "@prisma/client";
import { revalidatePath } from "next/cache";

const UpdatePersonalDetailsSchema = z.object({
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

export async function updatePersonalDetailsAction(formData: FormData) {
  try {
    const session = await requireSession();

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

    const parsed = UpdatePersonalDetailsSchema.safeParse(data);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "נתונים לא תקינים.";
      return { success: false, error: firstError };
    }

    // Check if personalNumber is unique (excluding current user)
    const existingUser = await prisma.user.findUnique({
      where: { personalNumber: parsed.data.personalNumber },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return { success: false, error: "מספר אישי כבר קיים במערכת." };
    }

    // Update user with new data
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
        },
      });

      // Update department association (delete old, add new)
      await tx.userDepartment.deleteMany({
        where: { userId: session.user.id },
      });

      await tx.userDepartment.create({
        data: {
          userId: session.user.id,
          departmentId: parsed.data.departmentId,
        },
      });

      // Update position association (delete old, add new)
      await tx.userPosition.deleteMany({
        where: { userId: session.user.id },
      });

      await tx.userPosition.create({
        data: {
          userId: session.user.id,
          positionId: parsed.data.positionId,
        },
      });
    });

    revalidatePath("/personal");
    return { success: true };
  } catch (error) {
    console.error("Update personal details error:", error);
    return { success: false, error: "אירעה שגיאה. נסה שוב." };
  }
}

