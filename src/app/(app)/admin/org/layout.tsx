import { AdminSectionTabs } from "../_components/AdminSectionTabs";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <AdminSectionTabs
        tabs={[
          { label: "מחלקות", href: "/admin/org/departments" },
          { label: "תפקידים", href: "/admin/org/positions" },
        ]}
      />
      {children}
    </div>
  );
}


