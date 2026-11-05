import type { Role } from "@prisma/client";

export type NavIcon =
  | "home"
  | "gear"
  | "user"
  | "shield"
  | "org"
  | "box"
  | "users"
  | "inbox"
  | "carton"
  | "export"
  | "target"
  | "tash"
  | "backup";

export type NavItem = {
  href: string;
  label: string;
  desc?: string;
  icon: NavIcon;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/me", label: "בית", icon: "home" },
  { href: "/requests", label: "ציוד", desc: "בקשות, הצהרות והעברות", icon: "gear" },
  { href: "/personal", label: "אזור אישי", desc: "הפרטים והציוד שלי", icon: "user" },
];

export const ADMIN_HOME: NavItem = { href: "/admin", label: "ניהול", desc: "לוח הבקרה", icon: "shield" };

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/org/departments", label: "מחלקות / תפקידים", desc: "ניהול מחלקות ותפקידים לפי מחלקה.", icon: "org" },
  { href: "/admin/inventory/storage", label: "מלאי · פריטים · יחידות · קרטונים", desc: "מלאי במחסן, ניהול פריטים ויחידות, תבנית קרטון.", icon: "box" },
  { href: "/admin/users", label: "משתמשים", desc: "ניהול משתמשים ותפקידים.", icon: "users" },
  { href: "/admin/requests", label: "בקשות", desc: "ניהול בקשות ציוד והעברות.", icon: "inbox" },
  { href: "/admin/boxes", label: "קרטונים", desc: "ניהול קרטוני ציוד לחיילים ומעקב מילוי.", icon: "carton" },
  { href: "/admin/exports", label: "ייצוא נתונים", desc: "הורדה ל-Excel / Google Sheets / CSV.", icon: "export" },
  { href: "/admin/weapons-and-sights", label: "נשקים וצלמים", desc: "מעקב אחר נשקים וצלמים מוקצים.", icon: "target" },
  { href: "/admin/tash", label: "ציוד ת״ש", desc: "כמויות לפי מיקום.", icon: "tash" },
];

/** Only SUPER_ADMIN / THEME_MASTER */
export const PRIVILEGED_NAV: NavItem[] = [
  { href: "/admin/backups", label: "גיבויים", desc: "גיבוי יומי אוטומטי, גיבוי ידני, בדיקה והורדה.", icon: "backup" },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/me") return pathname === "/me" || pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function roleLabelHe(role: Role | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "מנהל על";
    case "THEME_MASTER":
      return "מנהל על · עיצוב";
    case "ADMIN":
      return "מנהל";
    case "VIEW_ONLY":
      return "צפייה בלבד";
    default:
      return "חייל/ת";
  }
}
