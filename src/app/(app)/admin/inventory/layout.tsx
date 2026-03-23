import { AdminSectionTabs } from "../_components/AdminSectionTabs";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <AdminSectionTabs
        tabs={[
          { label: "מלאי", href: "/admin/inventory/storage" },
          { label: "פריטים", href: "/admin/inventory/items" },
          { label: "יחידות", href: "/admin/inventory/unit-templates" },
          { label: "תבנית קרטון", href: "/admin/inventory/box-template" },
        ]}
      />
      {children}
    </div>
  );
}


