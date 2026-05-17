export const ROUTES = {
  healthz: '/healthz',
  authCodeRequest: '/v1/auth/code/request',
  authCodeVerify: '/v1/auth/code/verify',
  authRefresh: '/v1/auth/refresh',
  authLogout: '/v1/auth/logout',
  me: '/v1/me',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
