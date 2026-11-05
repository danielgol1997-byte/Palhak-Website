"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminTab = {
  label: string;
  href: string;
};

export function AdminSectionTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="ui-hscroll border-b border-zinc-800">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex min-h-12 items-center px-4 sm:px-6 py-3 text-sm font-bold transition-all cursor-pointer relative whitespace-nowrap ${
                isActive
                  ? "bg-zinc-800 text-zinc-50 border-b-2 border-zinc-50"
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}


