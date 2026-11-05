import { Themed3DCard } from "@/components/Themed3DCard";
import { MobileTile } from "@/components/MobileTile";
import { NavIcon } from "@/components/layout/NavIcon";
import { ADMIN_NAV, PRIVILEGED_NAV } from "@/components/layout/nav";
import { getSession } from "@/lib/auth";
import { isPrivilegedOperator } from "@/lib/rbac";

export default async function AdminPage() {
  const session = await getSession();
  const privileged = session?.user?.role ? isPrivilegedOperator(session.user.role) : false;
  const links = privileged ? [...ADMIN_NAV, ...PRIVILEGED_NAV] : ADMIN_NAV;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-zinc-50">ניהול</h1>
        <p className="mt-1.5 text-sm leading-6 text-zinc-400">ניהול נתונים והגדרות מערכת.</p>
      </section>

      {/* Mobile: flat list */}
      <section className="flex flex-col gap-3 md:hidden">
        {links.map((link) => (
          <MobileTile key={link.href} href={link.href} title={link.label} subtitle={link.desc} icon={<NavIcon name={link.icon} size={24} />} />
        ))}
      </section>

      {/* Desktop: 3D cards */}
      <section className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <div key={link.href} className="min-h-[160px]">
            <Themed3DCard href={link.href} title={link.label} subtitle={link.desc} icon={<NavIcon name={link.icon} size={28} />} compact />
          </div>
        ))}
      </section>
    </div>
  );
}
