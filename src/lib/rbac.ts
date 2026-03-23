import { Role } from "@prisma/client";

export type AppRole = Role;

/** Roles with full system control (admin UI + user/role management like super admin). */
export const PRIVILEGED_OPERATOR_ROLES: Role[] = [Role.SUPER_ADMIN, Role.THEME_MASTER];

export function isPrivilegedOperator(role: AppRole): boolean {
  return PRIVILEGED_OPERATOR_ROLES.includes(role);
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
    case Role.USER:
      return 1;
    default:
      return 0;
  }
}

export function hasAtLeastRole(role: AppRole, required: AppRole): boolean {
  return roleRank(role) >= roleRank(required);
}


