import type { EmployeeRole } from '@reactionary/core';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type {
  MagentoCompanyAdmin,
  MagentoCompanyRole,
  MagentoCompanyUser,
} from '../../schema/company.types.js';

/** `MagentoConfiguration.companyRoleMapping`: Magento role id (uid) or name per core role. */
export type MagentoCompanyRoleMapping = NonNullable<MagentoConfiguration['companyRoleMapping']>;

function sameRole(role: MagentoCompanyRole, reference: string): boolean {
  return (
    role.id === reference ||
    (!!role.name && role.name.toLowerCase() === reference.toLowerCase())
  );
}

/** True when the user is the company administrator. */
export function isMagentoCompanyAdmin(
  user: MagentoCompanyUser,
  admin?: MagentoCompanyAdmin | null,
): boolean {
  if (!admin) {
    return false;
  }
  if (admin.id && user.id) {
    return admin.id === user.id;
  }
  return !!admin.email && !!user.email && admin.email.toLowerCase() === user.email.toLowerCase();
}

/**
 * Maps a Magento company role onto the core role: the company administrator
 * is `admin`, the role configured as `manager` is `manager`, anything else is
 * `employee`.
 */
export function parseMagentoEmployeeRole(
  role: MagentoCompanyRole | null | undefined,
  isAdmin: boolean,
  mapping: MagentoCompanyRoleMapping,
): EmployeeRole {
  if (isAdmin) {
    return 'admin';
  }
  if (role && mapping.manager && sameRole(role, mapping.manager)) {
    return 'manager';
  }
  return 'employee';
}

/**
 * The configured Magento role reference (id or name) for a core role, or an
 * empty string when there is none. The company administrator cannot be
 * assigned through a role in Magento, so `admin` never maps.
 */
export function mapToMagentoRoleReference(
  role: EmployeeRole,
  mapping: MagentoCompanyRoleMapping,
): string {
  switch (role) {
    case 'manager':
      return mapping.manager ?? '';
    case 'employee':
      return mapping.employee ?? '';
    default:
      return '';
  }
}

/** Resolves a role reference (id or name) against the company's roles. */
export function findMagentoCompanyRole(
  roles: MagentoCompanyRole[],
  reference: string,
): MagentoCompanyRole | undefined {
  return roles.find((role) => sameRole(role, reference));
}
