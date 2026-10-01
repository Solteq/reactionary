import { SessionSchema, type Cache, type Session } from '@reactionary/core';
import * as z from 'zod';

const SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:session';
const IDEMPOTENCY_CACHE_KEY_PREFIX = 'reactionary:ucp:idempotency';
const UCPActionResponseSchema = z.looseObject({});
const UCPIdempotencyRecordSchema = z.looseObject({
  action: z.string(),
  fingerprint: z.string().optional(),
  status: z.number().optional(),
  response: UCPActionResponseSchema,
});

export type UCPIdempotencyRecord = z.infer<typeof UCPIdempotencyRecordSchema>;

export class ReactionaryUCPSessionStore {
  public constructor(
    private readonly cache: Cache,
    private readonly ttlSeconds: number,
  ) {}

  public async get(sessionId: string): Promise<Session | undefined> {
    return (
      (await this.cache.get(
        this.getCacheKey(sessionId),
        SessionSchema,
      )) ?? undefined
    );
  }

  public async put(sessionId: string, session: Session): Promise<void> {
    await this.cache.invalidate([this.getDependencyId(sessionId)]);
    await this.cache.put(this.getCacheKey(sessionId), session, {
      ttlSeconds: this.ttlSeconds,
      dependencyIds: [this.getDependencyId(sessionId)],
    });
  }

  public async getIdempotencyRecord(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<UCPIdempotencyRecord | undefined> {
    return (
      (await this.cache.get(
        this.getIdempotencyCacheKey(sessionId, idempotencyKey),
        UCPIdempotencyRecordSchema,
      )) ?? undefined
    );
  }

  public async putIdempotencyRecord(
    sessionId: string,
    idempotencyKey: string,
    record: UCPIdempotencyRecord,
  ): Promise<void> {
    await this.cache.put(
      this.getIdempotencyCacheKey(sessionId, idempotencyKey),
      record,
      {
        ttlSeconds: this.ttlSeconds,
        dependencyIds: [this.getIdempotencyDependencyId(sessionId)],
      },
    );
  }

  private getCacheKey(sessionId: string): string {
    return `${SESSION_CACHE_KEY_PREFIX}:${sessionId}`;
  }

  private getDependencyId(sessionId: string): string {
    return `${SESSION_CACHE_KEY_PREFIX}:${sessionId}`;
  }

  private getIdempotencyCacheKey(
    sessionId: string,
    idempotencyKey: string,
  ): string {
    return `${IDEMPOTENCY_CACHE_KEY_PREFIX}:${sessionId}:${encodeURIComponent(idempotencyKey)}`;
  }

  private getIdempotencyDependencyId(sessionId: string): string {
    return `${IDEMPOTENCY_CACHE_KEY_PREFIX}:${sessionId}`;
  }
}
