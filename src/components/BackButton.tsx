"use client";

import { usePathname, useRouter } from "next/navigation";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show on the main home page
  if (pathname === "/me") {
    return null;
  }

  const handleBack = () => {
    // If on admin sub-page, go to admin dashboard
    if (pathname.startsWith("/admin/")) {
      router.push("/admin");
    } 
    // If on admin dashboard, go to home
    else if (pathname === "/admin") {
      router.push("/me");
    }
    // Otherwise go to home
    else {
      router.push("/me");
    }
  };

  return (
    <button
      onClick={handleBack}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-zinc-50 active:scale-90 cursor-pointer"
      aria-label="חזרה"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

