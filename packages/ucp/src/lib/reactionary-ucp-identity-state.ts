import { SessionSchema, type Cache } from '@reactionary/core';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import * as z from 'zod';

const USED_STATE_CACHE_KEY_PREFIX = 'reactionary:ucp:identity:used';
const REVOKED_TOKEN_CACHE_KEY_PREFIX = 'reactionary:ucp:identity:revoked';
const SESSION_OVERLAY_CACHE_KEY_PREFIX = 'reactionary:ucp:identity:session';

export const UCPAuthorizationRequestStateSchema = z.looseObject({
  clientId: z.string(),
  redirectUri: z.string(),
  scope: z.string(),
  state: z.string().optional(),
  codeChallenge: z.string(),
});

export const UCPConsentStateSchema = UCPAuthorizationRequestStateSchema.extend({
  customerId: z.string(),
  session: SessionSchema,
});

export const UCPAuthorizationCodeStateSchema = UCPConsentStateSchema;

export const UCPTokenStateSchema = z.looseObject({
  kind: z.enum(['access', 'refresh']),
  clientId: z.string(),
  customerId: z.string(),
  scope: z.string(),
  session: SessionSchema,
  refreshTokenHash: z.string().optional(),
});

export type UCPAuthorizationRequestState = z.infer<typeof UCPAuthorizationRequestStateSchema>;
export type UCPConsentState = z.infer<typeof UCPConsentStateSchema>;
export type UCPAuthorizationCodeState = z.infer<typeof UCPAuthorizationCodeStateSchema>;
export type UCPTokenState = z.infer<typeof UCPTokenStateSchema>;

export type UCPSealedStateKind = 'authorization_request' | 'consent' | 'code' | 'token';

const SealedEnvelopeSchema = z.object({
  kind: z.string(),
  expiresAt: z.number(),
  payload: z.unknown(),
});

export function hashIdentityToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Seals identity state into self-contained AES-256-GCM blobs so no shared
 * storage is required for correctness. The optional cache only enhances the
 * flow: single-use enforcement, instant revocation, and session freshness.
 */
export class ReactionaryUCPIdentityState {
  private readonly key: Buffer;

  public constructor(
    stateSecret: string,
    private readonly cache: Cache | undefined,
  ) {
    this.key = createHash('sha256').update(stateSecret).digest();
  }

  public seal(
    kind: UCPSealedStateKind,
    payload: unknown,
    ttlSeconds: number,
  ): string {
    const envelope = JSON.stringify({
      kind,
      expiresAt: Date.now() + ttlSeconds * 1000,
      payload,
    });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(deflateRawSync(Buffer.from(envelope, 'utf-8'))),
      cipher.final(),
    ]);

    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  }

  public open<TState>(
    kind: UCPSealedStateKind,
    sealed: string,
    schema: z.ZodType<TState>,
  ): { state: TState; expiresAt: number } | undefined {
    try {
      const raw = Buffer.from(sealed, 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const plaintext = inflateRawSync(
        Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]),
      ).toString('utf-8');
      const envelope = SealedEnvelopeSchema.parse(JSON.parse(plaintext));

      if (envelope.kind !== kind || envelope.expiresAt <= Date.now()) {
        return undefined;
      }

      return {
        state: schema.parse(envelope.payload),
        expiresAt: envelope.expiresAt,
      };
    } catch {
      return undefined;
    }
  }

  public async markUsed(sealed: string, ttlSeconds: number): Promise<boolean> {
    if (!this.cache) {
      return true;
    }

    const key = `${USED_STATE_CACHE_KEY_PREFIX}:${hashIdentityToken(sealed)}`;
    const existing = await this.cache.get(key, UsedMarkerSchema);

    if (existing) {
      return false;
    }

    await this.cache.put(key, { usedAt: Date.now() }, {
      ttlSeconds,
      dependencyIds: [key],
    });

    return true;
  }

  public async revokeToken(token: string, ttlSeconds: number): Promise<void> {
    if (!this.cache) {
      return;
    }

    const key = `${REVOKED_TOKEN_CACHE_KEY_PREFIX}:${hashIdentityToken(token)}`;
    await this.cache.invalidate([key]);
    await this.cache.put(key, { revokedAt: Date.now() }, {
      ttlSeconds,
      dependencyIds: [key],
    });
  }

  public async isTokenRevoked(tokenHashes: string[]): Promise<boolean> {
    if (!this.cache) {
      return false;
    }

    for (const tokenHash of tokenHashes) {
      const revoked = await this.cache.get(
        `${REVOKED_TOKEN_CACHE_KEY_PREFIX}:${tokenHash}`,
        RevokedMarkerSchema,
      );

      if (revoked) {
        return true;
      }
    }

    return false;
  }

  public async putSessionOverlay(
    tokenHash: string,
    session: UCPTokenState['session'],
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.cache) {
      return;
    }

    const key = `${SESSION_OVERLAY_CACHE_KEY_PREFIX}:${tokenHash}`;
    await this.cache.invalidate([key]);
    await this.cache.put(key, session, {
      ttlSeconds,
      dependencyIds: [key],
    });
  }

  public async getSessionOverlay(
    tokenHash: string,
  ): Promise<UCPTokenState['session'] | undefined> {
    if (!this.cache) {
      return undefined;
    }

    return (
      (await this.cache.get(
        `${SESSION_OVERLAY_CACHE_KEY_PREFIX}:${tokenHash}`,
        SessionSchema,
      )) ?? undefined
    );
  }
}

const UsedMarkerSchema = z.looseObject({
  usedAt: z.number(),
});

const RevokedMarkerSchema = z.looseObject({
  revokedAt: z.number(),
});
