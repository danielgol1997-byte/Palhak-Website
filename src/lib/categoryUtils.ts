import { prisma } from "./prisma";
import { Division } from "@prisma/client";

/**
 * Ensures a "General" category exists for the given division and returns its ID.
 * This allows us to hide the "Category" concept from the UI while keeping the DB schema intact.
 */
export async function ensureGeneralCategory(division: Division): Promise<string> {
  const name = "כללי";
  
  const category = await prisma.equipmentCategory.upsert({
    where: {
      division_name: {
        division,
        name,
      },
    },
    update: {},
    create: {
      division,
      name,
      active: true,
      sortOrder: 0,
    },
    select: { id: true },
  });

  return category.id;
}

