import { describe, expect, expectTypeOf, it } from 'vitest';

import * as api from '../index';
import { ROUTES, type RoutePath } from '../routes';

describe('@aj-now/api-contract package surface', () => {
  it('barrel re-exports the routes module', () => {
    expect(api).toHaveProperty('ROUTES');
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
