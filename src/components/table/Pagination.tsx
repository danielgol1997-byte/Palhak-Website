import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (totalPages <= 1) return null;

  const toFirst = () => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page") continue;
      const val = Array.isArray(v) ? v[0] : v;
      if (val !== undefined) usp.set(k, val);
    }
    usp.set("page", "1");
    return `${basePath}?${usp.toString()}`;
  };

  const toPage = (p: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val !== undefined) usp.set(k, val);
    }
    usp.set("page", String(p));
    return `${basePath}?${usp.toString()}`;
  };

  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <Link
        href={page > 1 ? toPage(page - 1) : toFirst()}
        aria-disabled={page <= 1}
        className={`inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-bold transition-all shadow-sm ${
          page <= 1 
            ? "border border-zinc-800 bg-zinc-900 text-zinc-600 opacity-50 cursor-not-allowed" 
            : "border border-zinc-800 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:scale-105 active:scale-95 cursor-pointer"
        }`}
      >
        הקודם
      </Link>
      <div className="text-sm font-bold text-zinc-500">
        עמוד {page} מתוך {totalPages}
      </div>
      <Link
        href={page < totalPages ? toPage(page + 1) : toPage(totalPages)}
        aria-disabled={page >= totalPages}
        className={`inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-bold transition-all shadow-sm ${
          page >= totalPages 
            ? "border border-zinc-800 bg-zinc-900 text-zinc-600 opacity-50 cursor-not-allowed" 
            : "border border-zinc-800 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:scale-105 active:scale-95 cursor-pointer"
        }`}
      >
        הבא
      </Link>
    </div>
  );
}


