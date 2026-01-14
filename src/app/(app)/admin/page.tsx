export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">ניהול</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">ניהול נתונים והגדרות מערכת.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {[
          { href: "/admin/org/departments", title: "מחלקות / תפקידים", desc: "ניהול מחלקות ותפקידים לפי מחלקה." },
          { href: "/admin/inventory/storage", title: "מלאי / פריטים / יחידות", desc: "מלאי במחסן, ניהול פריטים, וניהול יחידות." },
          { href: "/admin/users", title: "משתמשים", desc: "ניהול משתמשים ותפקידים." },
          { href: "/admin/requests", title: "בקשות", desc: "ניהול בקשות ציוד והעברות." },
          { href: "/admin/weapons-and-sights", title: "נשקים וצלמים", desc: "מעקב אחר נשקים וצלמים מוקצים." },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <div className="text-lg font-bold text-zinc-50 group-hover:text-zinc-50 transition-colors">{link.title}</div>
            <div className="mt-1 text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">{link.desc}</div>
          </a>
        ))}
      </section>
    </div>
  );
}


