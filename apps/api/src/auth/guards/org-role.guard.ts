import { JwtPayload, OrganizationRole } from '@fmbase/types';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DrizzleService } from '../../db/drizzle.service.js';
import { Reflector } from '@nestjs/core';
import { ORGANIZATION_ROLES_KEY } from '../decorators/require-org-role.decorator.js';
import {
  organizationMembers,
  organizations,
} from '../../db/schema/organizations.js';
import { and, eq, isNull } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  memberRole?: string;
}

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private drizzle: DrizzleService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // get<T>(key: string, target: Function): T;
    const requiredRole = this.reflector.get<OrganizationRole>(
      ORGANIZATION_ROLES_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const organizationSlug = request.params['slug'] as string;

    const [member] = await this.drizzle.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .leftJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(
        and(
          eq(organizations.slug, organizationSlug),
          eq(organizationMembers.userId, user.sub),
          isNull(organizationMembers.removedAt),
        ),
      )
      .limit(1);
    if (!member) throw new NotFoundException('Organization not found.');
    if (requiredRole && member.role !== requiredRole) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    request.memberRole = member.role;
    return true;
  }
}
