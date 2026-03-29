/**
 * Removes Tash (ציוד ת״ש) rows created by Playwright tash.spec.ts:
 * - Items named like "כיסא בדיקה_<timestamp>"
 * - Optional saved locations used only in those tests
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_ITEM_PREFIX = "כיסא בדיקה";
const TEST_LOCATIONS = ["בסיס צפון בדיקה", "בסיס דרום בדיקה"];

async function main() {
  const items = await prisma.tashItem.findMany({
    where: { name: { startsWith: TEST_ITEM_PREFIX } },
    select: { id: true, name: true },
  });

  if (items.length === 0) {
    console.log("No tash test items found (prefix:", TEST_ITEM_PREFIX + ").");
  } else {
    console.log("Deleting tash items:", items.map((i) => i.name).join(", "));
    const del = await prisma.tashItem.deleteMany({
      where: { name: { startsWith: TEST_ITEM_PREFIX } },
    });
    console.log("Deleted tash items:", del.count, "(inventory + logs cascade)");
  }

  const locDel = await prisma.tashLocation.deleteMany({
    where: { name: { in: TEST_LOCATIONS } },
  });
  console.log("Removed test-only saved locations:", locDel.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
