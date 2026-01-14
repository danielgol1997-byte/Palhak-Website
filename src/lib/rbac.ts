import { Role } from "@prisma/client";

export type AppRole = Role;

export function roleRank(role: AppRole): number {
  switch (role) {
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


