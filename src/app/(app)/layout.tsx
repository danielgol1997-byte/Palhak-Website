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
    <div className="relative min-h-dvh bg-zinc-950 text-zinc-50">
      {/* Background image layer (faded/low-contrast) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.14] grayscale-[0.15] contrast-75 saturate-75"
        style={{ backgroundImage: "url(/bg.jpg)" }}
        aria-hidden="true"
      />
      {/* Soft vignette so content stays readable */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-zinc-950/70 via-zinc-950/60 to-zinc-950"
        aria-hidden="true"
      />
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-3 group transition-all">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-white/5 opacity-0 blur transition duration-500 group-hover:opacity-100"></div>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-zinc-950 shadow-xl transition-all duration-300 group-hover:scale-105 active:scale-95">
                  <span className="text-2xl font-black leading-none select-none">א</span>
                </div>
              </div>
              <div className="flex flex-col -space-y-1.5 min-w-0">
                <span className="text-2xl font-black tracking-tighter text-zinc-50 select-none">
                  אשר
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] select-none truncate">
                  INVENTORY
                </span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm font-medium text-zinc-400">
              {session?.user?.name ?? ""}
            </div>
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


