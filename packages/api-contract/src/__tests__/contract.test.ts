import { selectReporterSchema } from '@aj-now/db/zod';
import { describe, expect, expectTypeOf, it } from 'vitest';

import * as api from '../index';
import { ROUTES, type RoutePath } from '../routes';
import {
  AuthCodeAckSchema,
  AuthCodeRequestSchema,
  AuthCodeVerifyResponseSchema,
  AuthCodeVerifySchema,
  AuthLogoutSchema,
  AuthRefreshResponseSchema,
  AuthRefreshSchema,
  HealthzResponseSchema,
  ReporterPatchSchema,
  ReporterSchema,
} from '../types';

const validReporter = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'reporter@example.com',
  full_name: 'Test Reporter',
  preferred_lang: 'en',
  skills: [],
  languages: [],
  expertise: [],
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

describe('@aj-now/api-contract package surface', () => {
  it('barrel re-exports the routes module', () => {
    expect(api).toHaveProperty('ROUTES');
  });

  it('barrel re-exports the types module', () => {
    expect(api).toHaveProperty('ReporterSchema');
  });
});

describe('ROUTES', () => {
  it('exposes the Phase 2 v0 endpoint paths', () => {
    expect(ROUTES.healthz).toBe('/healthz');
    expect(ROUTES.authCodeRequest).toBe('/v1/auth/code/request');
    expect(ROUTES.authCodeVerify).toBe('/v1/auth/code/verify');
    expect(ROUTES.authRefresh).toBe('/v1/auth/refresh');
    expect(ROUTES.authLogout).toBe('/v1/auth/logout');
    expect(ROUTES.me).toBe('/v1/me');
  });

  it('RoutePath is the union of declared paths', () => {
    expectTypeOf<RoutePath>().toEqualTypeOf<
      | '/healthz'
      | '/v1/auth/code/request'
      | '/v1/auth/code/verify'
      | '/v1/auth/refresh'
      | '/v1/auth/logout'
      | '/v1/me'
    >();
  });
});

describe('ReporterSchema (no-drift contract with @aj-now/db)', () => {
  it('exposes exactly the 9 wire-safe columns', () => {
    const wireSafe = [
      'id',
      'email',
      'full_name',
      'preferred_lang',
      'skills',
      'languages',
      'expertise',
      'created_at',
      'updated_at',
    ].sort();
    expect(Object.keys(ReporterSchema.shape).sort()).toEqual(wireSafe);
  });

  it('drops every db column not in the wire-safe set', () => {
    const wireKeys = new Set(Object.keys(ReporterSchema.shape));
    const dropped = Object.keys(selectReporterSchema.shape).filter((k) => !wireKeys.has(k));
    expect(dropped.sort()).toEqual(['device_pubkey', 'external_id']);
  });

  it('parses a valid snake_case reporter payload', () => {
    expect(ReporterSchema.safeParse(validReporter).success).toBe(true);
  });

  it('rejects a reporter payload missing a required column', () => {
    const incomplete = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'reporter@example.com',
    };
    expect(ReporterSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe('Auth endpoint schemas', () => {
  it('AuthCodeRequestSchema accepts a valid email, rejects malformed', () => {
    expect(AuthCodeRequestSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(AuthCodeRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('AuthCodeAckSchema requires ok:true; dev_code optional', () => {
    expect(AuthCodeAckSchema.safeParse({ ok: true }).success).toBe(true);
    expect(AuthCodeAckSchema.safeParse({ ok: true, dev_code: '123456' }).success).toBe(true);
    expect(AuthCodeAckSchema.safeParse({ ok: false }).success).toBe(false);
  });

  it('AuthCodeVerifySchema requires email and non-empty code', () => {
    expect(
      AuthCodeVerifySchema.safeParse({ email: 'a@b.com', code: '123456' }).success,
    ).toBe(true);
    expect(AuthCodeVerifySchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    expect(AuthCodeVerifySchema.safeParse({ email: 'a@b.com', code: '' }).success).toBe(false);
  });

  it('AuthCodeVerifyResponseSchema bundles tokens with embedded reporter', () => {
    expect(
      AuthCodeVerifyResponseSchema.safeParse({
        access_token: 'at',
        refresh_token: 'rt',
        reporter: validReporter,
      }).success,
    ).toBe(true);
    expect(
      AuthCodeVerifyResponseSchema.safeParse({ access_token: 'at', refresh_token: 'rt' }).success,
    ).toBe(false);
  });

  it('AuthRefreshSchema + response require refresh_token', () => {
    expect(AuthRefreshSchema.safeParse({ refresh_token: 'rt' }).success).toBe(true);
    expect(AuthRefreshSchema.safeParse({}).success).toBe(false);
    expect(AuthRefreshSchema.safeParse({ refresh_token: '' }).success).toBe(false);
    expect(
      AuthRefreshResponseSchema.safeParse({ access_token: 'at', refresh_token: 'rt' }).success,
    ).toBe(true);
    expect(AuthRefreshResponseSchema.safeParse({ access_token: 'at' }).success).toBe(false);
  });

  it('AuthLogoutSchema requires non-empty refresh_token', () => {
    expect(AuthLogoutSchema.safeParse({ refresh_token: 'rt' }).success).toBe(true);
    expect(AuthLogoutSchema.safeParse({}).success).toBe(false);
    expect(AuthLogoutSchema.safeParse({ refresh_token: '' }).success).toBe(false);
  });
});

describe('/v1/me and /healthz schemas', () => {
  it('HealthzResponseSchema accepts {ok: true}, rejects {ok: false}', () => {
    expect(HealthzResponseSchema.safeParse({ ok: true }).success).toBe(true);
    expect(HealthzResponseSchema.safeParse({ ok: false }).success).toBe(false);
    expect(HealthzResponseSchema.safeParse({}).success).toBe(false);
  });

  it('ReporterPatchSchema accepts empty object (no fields to update)', () => {
    expect(ReporterPatchSchema.safeParse({}).success).toBe(true);
  });

  it('ReporterPatchSchema accepts a single-field patch', () => {
    expect(ReporterPatchSchema.safeParse({ full_name: 'New Name' }).success).toBe(true);
    expect(ReporterPatchSchema.safeParse({ preferred_lang: 'ar' }).success).toBe(true);
  });

  it('ReporterPatchSchema rejects unknown keys (typo-safe by default)', () => {
    expect(
      ReporterPatchSchema.safeParse({ preferreed_lang: 'ar' }).success,
    ).toBe(false);
  });
});
