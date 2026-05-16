import { SignJWT, jwtVerify, type KeyLike } from 'jose';
import {
  AccessClaimSchema,
  RefreshClaimSchema,
  type AccessClaim,
  type RefreshClaim,
} from './claims';

const ALG = 'ES256';
const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL = '7d';

export type SignOpts = {
  expiresIn?: string;
};

type AccessInput = Omit<AccessClaim, 'iat' | 'exp'>;
type RefreshInput = Omit<RefreshClaim, 'iat' | 'exp'>;

async function sign(
  payload: Record<string, unknown>,
  privateKey: KeyLike,
  ttl: string,
  opts?: SignOpts,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(opts?.expiresIn ?? ttl)
    .sign(privateKey);
}

export function signAccessToken(
  claim: AccessInput,
  privateKey: KeyLike,
  opts?: SignOpts,
): Promise<string> {
  return sign({ ...claim }, privateKey, DEFAULT_ACCESS_TTL, opts);
}

export async function verifyAccessToken(token: string, publicKey: KeyLike): Promise<AccessClaim> {
  const { payload } = await jwtVerify(token, publicKey, { algorithms: [ALG] });
  return AccessClaimSchema.parse(payload);
}

export function signRefreshToken(
  claim: RefreshInput,
  privateKey: KeyLike,
  opts?: SignOpts,
): Promise<string> {
  return sign({ ...claim }, privateKey, DEFAULT_REFRESH_TTL, opts);
}

export async function verifyRefreshToken(
  token: string,
  publicKey: KeyLike,
): Promise<RefreshClaim> {
  const { payload } = await jwtVerify(token, publicKey, { algorithms: [ALG] });
  return RefreshClaimSchema.parse(payload);
}
