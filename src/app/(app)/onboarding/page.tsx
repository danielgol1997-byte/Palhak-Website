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
        discontinued: false,
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
      <div className="w-full max-w-2xl py-12">
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div className="absolute -inset-2 rounded-2xl bg-white/5 opacity-0 blur-lg transition duration-500 group-hover:opacity-100"></div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-950 shadow-2xl transition-all duration-300">
                <span className="text-4xl font-black leading-none select-none">א</span>
              </div>
            </div>
            <div className="flex flex-col -space-y-2">
              <span className="text-4xl font-black tracking-tighter text-zinc-50 select-none">
                אשר
              </span>
              <span className="text-sm font-bold text-emerald-500 uppercase tracking-[0.3em] select-none">
                INVENTORY
              </span>
            </div>
          </div>
        </div>

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

