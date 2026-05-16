import { beforeAll, describe, expect, it } from 'vitest';
import { errors, generateKeyPair, type KeyLike } from 'jose';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../jwt';

describe('@aj-now/auth jwt', () => {
  let privateKey: KeyLike;
  let publicKey: KeyLike;

  beforeAll(async () => {
    const keys = await generateKeyPair('ES256', { extractable: true });
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
  });

  it('round-trips an access claim through sign + verify', async () => {
    const claim = {
      sub: 'reporter-uuid-1',
      email: 'alice@example.com',
      roles: ['reporter'],
      reporter_id: 'reporter-uuid-1',
    };
    const token = await signAccessToken(claim, privateKey);
    const verified = await verifyAccessToken(token, publicKey);
    expect(verified.sub).toBe(claim.sub);
    expect(verified.email).toBe(claim.email);
    expect(verified.reporter_id).toBe(claim.reporter_id);
    expect(verified.roles).toEqual(claim.roles);
    expect(typeof verified.iat).toBe('number');
    expect(typeof verified.exp).toBe('number');
  });

  it('rejects a token whose payload has been tampered', async () => {
    const claim = {
      sub: 'reporter-uuid-2',
      email: 'bob@example.com',
      roles: ['reporter'],
      reporter_id: 'reporter-uuid-2',
    };
    const token = await signAccessToken(claim, privateKey);
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('unexpected JWT format');
    const [header, payload, signature] = parts as [string, string, string];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.email = 'eve@example.com';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url').replace(/=+$/, '');
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
    await expect(verifyAccessToken(tamperedToken, publicKey)).rejects.toBeInstanceOf(
      errors.JWSSignatureVerificationFailed,
    );
  });

  it('rejects an expired access token', async () => {
    const claim = {
      sub: 'reporter-uuid-3',
      email: 'carol@example.com',
      roles: ['reporter'],
      reporter_id: 'reporter-uuid-3',
    };
    const token = await signAccessToken(claim, privateKey, { expiresIn: '-1s' });
    await expect(verifyAccessToken(token, publicKey)).rejects.toBeInstanceOf(errors.JWTExpired);
  });

  it('round-trips a refresh claim through sign + verify', async () => {
    const claim = { sub: 'reporter-uuid-4', jti: 'token-id-1' };
    const token = await signRefreshToken(claim, privateKey);
    const verified = await verifyRefreshToken(token, publicKey);
    expect(verified.sub).toBe(claim.sub);
    expect(verified.jti).toBe(claim.jti);
    expect(typeof verified.iat).toBe('number');
    expect(typeof verified.exp).toBe('number');
  });
});
