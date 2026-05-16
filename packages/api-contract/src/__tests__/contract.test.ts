import { selectReporterSchema } from '@aj-now/db/zod';
import { describe, expect, expectTypeOf, it } from 'vitest';

import * as api from '../index';
import { ROUTES, type RoutePath } from '../routes';
import { ReporterSchema } from '../types';

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
    const payload = {
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
    expect(ReporterSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects a reporter payload missing a required column', () => {
    const incomplete = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'reporter@example.com',
    };
    expect(ReporterSchema.safeParse(incomplete).success).toBe(false);
  });
});
