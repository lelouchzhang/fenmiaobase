import { BadRequestException, Injectable } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import { JwtService } from '@nestjs/jwt';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import {
  organizationMembers,
  organizations,
} from '../db/schema/organizations.js';
import { and, eq, isNull } from 'drizzle-orm';
import { users } from '../db/schema/users.js';

interface InvitePayload {
  email: string;
  organizationId: string;
  organizationName: string;
}

@Injectable()
export class InviteService {
  private resend: Resend;
  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendInvite(organizationSlug: string, email: string) {
    const [organization] = await this.drizzle.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, organizationSlug))
      .limit(1);

    if (!organization) throw new BadRequestException('Organization not found');

    const existingUser = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser.length > 0) {
      const existingMember = await this.drizzle.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organization.id),
            eq(organizationMembers.userId, existingUser[0].id),
            isNull(organizationMembers.removedAt),
          ),
        );
      if (existingMember.length > 0)
        throw new BadRequestException(
          'User is already a member of this organization',
        );
    }
    const token = this.jwtService.sign(
      {
        email,
        organizationId: organization.id,
        organizationName: organization.name,
      } satisfies InvitePayload,
      {
        secret: this.configService.get<string>('JINVITE_SECRET'),
        expiresIn: this.configService.get('INVITE_EXPIRES_IN'),
      },
    );

    const inviteUrl = `${this.configService.get<string>('API_URL')}/auth/invite/accept?token=${token}`;

    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `You've been invited to join ${organization.name} on Fmbase.`,
      html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited to join ${organization.name}</h2>
          <p>Someone has invited you to collaborate on Fmbase.</p>
          <a
            href="${inviteUrl}"
            style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Accept invite
          </a>
          <p style="color: #999; font-size: 13px;">This link expires in 24 hours.</p>
        </div>
      `,
    });

    return { message: 'Invite sent' };
  }

  async acceptInvite(token: string) {
    let payload: InvitePayload;

    try {
      payload = this.jwtService.verify<InvitePayload>(token, {
        secret: this.configService.get<string>('JWT_INVITE_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or Expired invite link');
    }

    let [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    if (!user) {
      const [newUser] = await this.drizzle.db
        .insert(users)
        .values({
          email: payload.email,
        })
        .returning();

      user = newUser;
    }

    const existing = await this.drizzle.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, payload.organizationId),
          eq(organizationMembers.userId, user.id),
          isNull(organizationMembers.removedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { message: 'Already a member' };
    }

    await this.drizzle.db.insert(organizationMembers).values({
      organizationId: payload.organizationId,
      userId: user.id,
      role: 'developer',
    });

    return { message: 'Invite accepted', email: user.email };
  }
}
