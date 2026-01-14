import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { Role } from "@prisma/client";
import { BackButton } from "@/components/BackButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-50">
                פלוגת״ק — ניהול ציוד
              </div>
              <div className="truncate text-xs text-zinc-400">
                {session?.user?.name ?? ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SignOutButton />
            <BackButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-24">
        {children}
      </main>
    </div>
  );
}


