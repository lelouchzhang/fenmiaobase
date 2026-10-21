import { ORGANIZATION_ROLES } from '@fmbase/constants';
import type { OrganizationRole } from '@fmbase/types';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @IsEnum(ORGANIZATION_ROLES)
  role!: OrganizationRole;
}
