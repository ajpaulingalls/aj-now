import { z } from 'zod';

export const AccessClaimSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  roles: z.array(z.string()),
  reporter_id: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export type AccessClaim = z.infer<typeof AccessClaimSchema>;

export const RefreshClaimSchema = z.object({
  sub: z.string(),
  jti: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export type RefreshClaim = z.infer<typeof RefreshClaimSchema>;
