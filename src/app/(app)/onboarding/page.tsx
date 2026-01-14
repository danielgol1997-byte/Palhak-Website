import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireSession();

  // If already onboarded, redirect to home
  if (session.user.onboardedAt) {
    redirect("/me");
  }

  // Fetch departments, positions (with department info), and weapon items
  const [departments, positions, weaponItems] = await Promise.all([
    prisma.department.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.position.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
      },
    }),
    prisma.equipmentItem.findMany({
      where: { 
        active: true,
        isWeapon: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">ברוכים הבאים!</h1>
            <p className="text-zinc-400">
              נא להשלים את הפרטים הבאים לצורך הרישום במערכת
            </p>
          </div>

          <OnboardingForm 
            departments={departments} 
            positions={positions} 
            weaponItems={weaponItems}
          />
        </div>
      </div>
    </div>
  );
}

