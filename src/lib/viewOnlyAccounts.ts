export const VIEW_ONLY_DENIED_MESSAGE =
  "מצב צפייה בלבד — אין הרשאה לשנות נתונים.";

/** Accounts that are created as view-only. Matched case-insensitively. */
const VIEW_ONLY_ACCOUNT_EMAILS = new Set(["adibendor@gmail.com"]);

export function isViewOnlyAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return VIEW_ONLY_ACCOUNT_EMAILS.has(email.trim().toLowerCase());
}
