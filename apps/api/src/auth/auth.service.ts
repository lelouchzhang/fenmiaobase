import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthTokens, JwtPayload } from '@fmbase/types';
import { Response } from 'express';
import { COOKIE_KEYS } from '@fmbase/constants';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto.js';
import {
  users,
  organizations,
  organizationMembers,
} from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService, // inject DrizzleService to access the database
    private jwtService: JwtService, // inject JwtService to handle JWT operations
    private configService: ConfigService, // inject ConfigService to access environment variables and configuration settings
  ) {}

  // helpers
  setTokenCookies(res: Response, tokens: AuthTokens) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const accessTokenTtlMs = Number(
      this.configService.get<string>('AUTH_ACCESS_TOKEN_TTL_MS'),
    );
    const refreshTokenTtlMs = Number(
      this.configService.get<string>('AUTH_REFRESH_TOKEN_TTL_MS'),
    );

    res.cookie(COOKIE_KEYS.ACCESS_TOKEN, tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge:
        Number.isFinite(accessTokenTtlMs) && accessTokenTtlMs > 0
          ? accessTokenTtlMs
          : 15 * 60 * 1000,
    });

    res.cookie(COOKIE_KEYS.REFRESH_TOKEN, tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge:
        Number.isFinite(refreshTokenTtlMs) && refreshTokenTtlMs > 0
          ? refreshTokenTtlMs
          : 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearTokenCookies(res: Response) {
    res.clearCookie(COOKIE_KEYS.ACCESS_TOKEN);
    res.clearCookie(COOKIE_KEYS.REFRESH_TOKEN);
  }

  // Slug helper
  private generateOrganizationSlug(name: string): string {
    const base = slugify(`${name}-org`, { lower: true, strict: true });
    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  // JWT helpers
  private signTokens(userId: string, email: string): AuthTokens {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  // email + password
  async register(dto: RegisterDto) {
    const existing = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.drizzle.db
      .insert(users)
      .values({ email: dto.email, passwordHash, name: dto.name })
      .returning();

    const [orgination] = await this.drizzle.db
      .insert(organizations)
      .values({
        name: `${dto.name}'s Organization`,
        slug: this.generateOrganizationSlug(dto.name),
      })
      .returning();
    await this.drizzle.db.insert(organizationMembers).values({
      organizationId: orgination.id,
      userId: user.id,
      role: 'admin',
    });

    return this.signTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        'Application does not support this login method',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    return this.signTokens(user.id, user.email);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const [user] = await this.drizzle.db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user) throw new UnauthorizedException();

      return this.signTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh-token');
    }
  }

  // helpers create OAuth user
  async handleOAuthUser(profile: {
    email: string;
    name: string;
    avatarUrl: string | null;
  }): Promise<AuthTokens> {
    let [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);

    if (!user) {
      const [newUser] = await this.drizzle.db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        })
        .returning();

      user = newUser;

      const [organization] = await this.drizzle.db
        .insert(organizations)
        .values({
          name: `${profile.name}'s Organization`,
          slug: this.generateOrganizationSlug(profile.name),
        })
        .returning();

      await this.drizzle.db.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: 'admin',
      });
    }

    return this.signTokens(user.id, user.email);
  }

  // Google OAuth
  async getGoogleAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
      redirect_uri: this.configService.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<AuthTokens> {
    const tokenResponse = await fetch(`https://oauth2.googleapis.com/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
        client_secret:
          this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri:
          this.configService.get<string>('GOOGLE_CALLBACK_URL') ?? '',
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResponse.json()) satisfies {
      access_token: string;
    };

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const profile = (await profileResponse.json()) satisfies {
      email: string;
      name: string;
      picture?: string;
    };

    return this.handleOAuthUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture ?? null,
    });
  }

  // Github OAuth
  getGithubAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.configService.get<string>('GITHUB_CLIENT_ID')!,
      redirect_uri: this.configService.get<string>('GITHUB_CALLBACK_URL')!,
      scope: 'read:user user:email',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGithubCallback(code: string): Promise<AuthTokens> {
    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.configService.get<string>('GITHUB_CLIENT_ID'),
          client_secret: this.configService.get<string>('GITHUB_CLIENT_SECRET'),
          code,
          redirect_uri: this.configService.get<string>('GITHUB_CALLBACK_URL'),
        }),
      },
    );

    const tokenData = (await tokenRes.json()) satisfies {
      access_token: string;
    };

    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const profile = (await profileRes.json()) satisfies {
      email: string | null;
      name: string | null;
      login: string;
      avatar_url: string | null;
    };

    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const emails = (await emailRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }

    return this.handleOAuthUser({
      email: email!,
      name: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url ?? null,
    });
  }
}
