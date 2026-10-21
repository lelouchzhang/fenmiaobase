import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import { randomBytes } from 'crypto';
import slugify from 'slugify';
import {
  organizationMembers,
  organizations,
  projects,
} from '../db/schema/index.js';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private drizzle: DrizzleService) {}

  private generateOrgSlug(name: string): string {
    const base = slugify(`${name}-org`, { lower: true, strict: true });
    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  async getMyOrganizations(userId: string) {
    return this.drizzle.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        role: organizationMembers.role,
        projectCount: sql<number>`cast(count(distinct ${projects.id}) as int)`,
        memberCount: sql<number>`(
        select cast(count(*) as int)
        from organization_members om
        where om.organization_id = ${organizations.id}
          and om.removed_at is null
      )`,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .leftJoin(projects, eq(projects.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, userId),
          isNull(organizationMembers.removedAt),
        ),
      )
      .groupBy(organizations.id, organizationMembers.role);
  }

  async getOrganizationBySlug(slug: string, userId: string) {
    const [row] = await this.drizzle.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        role: organizationMembers.role,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, userId),
          isNull(organizationMembers.removedAt),
        ),
      )
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!row) throw new NotFoundException('organizations not found.');
    return row;
  }

  async createOrganization(dto: CreateOrganizationDto, userId: string) {
    const [organization] = await this.drizzle.db
      .insert(organizations)
      .values({
        name: dto.name,
        slug: this.generateOrgSlug(dto.name),
      })
      .returning();

    await this.drizzle.db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: userId,
      role: 'admin',
    });
    return organization;
  }
}
