"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/auth" })}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 px-3 text-sm font-semibold text-zinc-50 transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95 cursor-pointer"
    >
      יציאה
    </button>
  );
}


