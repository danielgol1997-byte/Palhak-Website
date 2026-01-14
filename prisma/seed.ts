import { PrismaClient, Division, Role } from "@prisma/client";

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const email = requireEnv("SEED_SUPER_ADMIN_EMAIL").trim().toLowerCase();
  const name = requireEnv("SEED_SUPER_ADMIN_NAME").trim();

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: Role.SUPER_ADMIN,
      active: true,
    },
    update: {
      name,
      role: Role.SUPER_ADMIN,
      active: true,
    },
  });

  await prisma.storageLocation.upsert({
    where: { name: "מחסן מרכזי" },
    create: { name: "מחסן מרכזי", active: true },
    update: { active: true },
  });

  const baselineCategories: Array<{ division: Division; name: string; sortOrder: number }> =
    [
      { division: Division.COMBAT, name: "כללי", sortOrder: 0 },
      { division: Division.LOGISTICS, name: "כללי", sortOrder: 0 },
      { division: Division.MEDICAL, name: "כללי", sortOrder: 0 },
    ];

  for (const c of baselineCategories) {
    await prisma.equipmentCategory.upsert({
      where: { division_name: { division: c.division, name: c.name } },
      create: {
        division: c.division,
        name: c.name,
        active: true,
        sortOrder: c.sortOrder,
      },
      update: {
        active: true,
        sortOrder: c.sortOrder,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


