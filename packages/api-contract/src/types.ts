import { selectReporterSchema } from '@aj-now/db/zod';
import { z } from 'zod';

export const ReporterSchema = selectReporterSchema.omit({
  external_id: true,
  device_pubkey: true,
});
export type Reporter = z.infer<typeof ReporterSchema>;

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const AuthCodeRequestSchema = z.object({
  email: z.string().email(),
});
export type AuthCodeRequest = z.infer<typeof AuthCodeRequestSchema>;

export const AuthCodeAckSchema = z.object({
  ok: z.literal(true),
  dev_code: z.string().optional(),
});
export type AuthCodeAck = z.infer<typeof AuthCodeAckSchema>;

export const AuthCodeVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});
export type AuthCodeVerify = z.infer<typeof AuthCodeVerifySchema>;

export const AuthCodeVerifyResponseSchema = TokenPairSchema.extend({
  reporter: ReporterSchema,
});
export type AuthCodeVerifyResponse = z.infer<typeof AuthCodeVerifyResponseSchema>;

export const AuthRefreshSchema = z.object({
  refresh_token: z.string().min(1),
});
export type AuthRefresh = z.infer<typeof AuthRefreshSchema>;

export const AuthRefreshResponseSchema = TokenPairSchema;
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;

export const AuthLogoutSchema = z.object({
  refresh_token: z.string().min(1),
});
export type AuthLogout = z.infer<typeof AuthLogoutSchema>;

export const HealthzResponseSchema = z.object({
  ok: z.literal(true),
});
export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;

// Wire-immutable fields are omitted before .partial() so the contract documents
// the actually-mutable surface. .strict() rejects unknown keys so a typo like
// `preferreed_lang` fails loudly instead of silently dropping the field.
// Value-level validation (preferred_lang enum, array trim/max-20) is endpoint
// policy per decision api-wire-casing.
export const ReporterPatchSchema = ReporterSchema.omit({
  id: true,
  email: true,
  created_at: true,
  updated_at: true,
})
  .partial()
  .strict();
export type ReporterPatch = z.infer<typeof ReporterPatchSchema>;
