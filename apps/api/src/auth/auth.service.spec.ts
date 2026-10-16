import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { organizations } from '../db/schema/index.js';

describe('AuthService', () => {
  it('creates a new OAuth user when the same email is used with a different provider', async () => {
    const insertedRows: Record<string, unknown>[] = [];

    const drizzle = {
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: (values: Record<string, unknown>) => {
            insertedRows.push(values);

            return {
              returning: async () => {
                if (table === organizations) {
                  return [{ id: 'org-1', ...values }];
                }

                return [{ id: 'user-1', ...values }];
              },
            };
          },
        }),
      },
    } as any;

    const service = new AuthService(
      drizzle,
      {
        sign: vi.fn((payload) => `token-${payload.sub}`),
      } as any,
      {
        get: vi.fn((key: string) => {
          const config: Record<string, string> = {
            JWT_ACCESS_SECRET: 'access-secret',
            JWT_REFRESH_SECRET: 'refresh-secret',
            JWT_ACCESS_EXPIRES_IN: '15m',
            JWT_REFRESH_EXPIRES_IN: '7d',
          };

          return config[key] ?? 'value';
        }),
      } as any,
    );

    await service.handleOAuthUser({
      email: 'same@example.com',
      name: 'Alice',
      avatarUrl: null,
      provider: 'google',
      providerUserId: 'google-123',
    });

    expect(insertedRows).toContainEqual(
      expect.objectContaining({
        email: 'same@example.com',
        provider: 'google',
        providerUserId: 'google-123',
      }),
    );
  });
});
