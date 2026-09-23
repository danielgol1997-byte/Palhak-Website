import { Role } from "@prisma/client";
import { VIEW_ONLY_DENIED_MESSAGE } from "@/lib/viewOnlyAccounts";

export type AppRole = Role;

export { VIEW_ONLY_DENIED_MESSAGE };

/** Roles with full system control (admin UI + user/role management like super admin). */
export const PRIVILEGED_OPERATOR_ROLES: Role[] = [Role.SUPER_ADMIN, Role.THEME_MASTER];

export function isPrivilegedOperator(role: AppRole): boolean {
  return PRIVILEGED_OPERATOR_ROLES.includes(role);
}

export function isViewOnly(role: AppRole): boolean {
  return role === Role.VIEW_ONLY;
}

/** View-only can open every screen, but cannot create, edit, approve, or delete. */
export function canMutate(role: AppRole): boolean {
  return !isViewOnly(role);
}

export function roleRank(role: AppRole): number {
  switch (role) {
    // יובל על חלל: same tier as super admin — full admin + theme studio
    case Role.THEME_MASTER:
      return 3;
    case Role.SUPER_ADMIN:
      return 3;
    case Role.ADMIN:
      return 2;
    // Same view tier as admin. Writes are rejected separately via canMutate.
    case Role.VIEW_ONLY:
      return 2;
    case Role.USER:
      return 1;
    default:
      return 0;
  }
}

export function hasAtLeastRole(role: AppRole, required: AppRole): boolean {
  return roleRank(role) >= roleRank(required);
}


