import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { and, eq, isNull } from 'drizzle-orm';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Injectable()
export class MembersService {
  constructor(private drizzle: DrizzleService) {}

  async getMembers(organizationSlug: string) {
    return await this.drizzle.db
      .select({
        id: organizationMembers.id,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(organizationMembers)
      .leftJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          eq(organizations.slug, organizationSlug),
          isNull(organizationMembers.removedAt),
        ),
      );
  }

  private async ensureNotLastAdmin(organizationSlug: string, memberId: string) {
    const admins = await this.drizzle.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(
        and(
          eq(organizations.slug, organizationSlug),
          eq(organizationMembers.role, 'admin'),
          isNull(organizationMembers.removedAt),
        ),
      );
    const targetIsAdmin = admins.some((a) => a.id === memberId);
    if (targetIsAdmin && admins.length === 1) {
      throw new BadRequestException(
        'Cannot remove or demote the last admin of an organization',
      );
    }
  }
  async updateRole(
    organizationSlug: string,
    memberId: string,
    dto: UpdateRoleDto,
  ) {
    if (dto.role === 'developer') {
      await this.ensureNotLastAdmin(organizationSlug, memberId);
    }

    const [updated] = await this.drizzle.db
      .update(organizationMembers)
      .set({ role: dto.role })
      .where(eq(organizationMembers.id, memberId))
      .returning();
    if (!updated) throw new NotFoundException('Member not found');
    return updated;
  }

  async removeMember(organizationSlug: string, memberId: string) {
    await this.ensureNotLastAdmin(organizationSlug, memberId);
    const [deleted] = await this.drizzle.db
      .update(organizationMembers)
      .set({ removedAt: new Date() })
      .where(eq(organizationMembers.id, memberId))
      .returning();
    if (!deleted) throw new NotFoundException('Member not found');
    return { message: 'Member removed' };
  }
}
