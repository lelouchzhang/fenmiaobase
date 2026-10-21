import { OrganizationRole } from '@fmbase/types';
import { SetMetadata } from '@nestjs/common';

export const ORGANIZATION_ROLES_KEY = 'organizationRoles';

export const RequireOrgRole = (role: OrganizationRole) => {
  return SetMetadata(ORGANIZATION_ROLES_KEY, role);
};
