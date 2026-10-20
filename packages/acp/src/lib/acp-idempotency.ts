import type { Cache } from '@reactionary/core';
import { createHash } from 'node:crypto';
import * as z from 'zod';

const IDEMPOTENCY_CACHE_KEY_PREFIX = 'reactionary:acp:idempotency';
const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
/** Keys MUST be retained for at least 24 hours (checkout RFC §6.6). */
export const ACP_MIN_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
/** How long an in-flight marker survives a crashed request. */
const IN_FLIGHT_TTL_SECONDS = 60;
const RETRY_AFTER_SECONDS = 1;

const ACPIdempotencyRecordSchema = z.looseObject({
  fingerprint: z.string(),
  inFlight: z.boolean(),
  status: z.number().optional(),
  body: z.string().optional(),
});

type ACPIdempotencyRecord = z.infer<typeof ACPIdempotencyRecordSchema>;

/**
 * ACP idempotency (checkout RFC §6): every POST carries an Idempotency-Key,
 * scoped to the authenticated identity and endpoint. A replay of the same
 * body returns the stored response without re-executing side effects; a
 * different body is a conflict, and a key still being processed is in
 * flight. Server errors are never stored, so a retry runs afresh.
 *
 * The cache offers no atomic insert, so concurrent requests on one instance
 * are additionally serialized in memory; across instances the in-flight
 * marker is best effort.
 */
export class ACPIdempotency {
  /** Fingerprints of the requests in flight on this instance, by cache key. */
  private readonly inFlight = new Map<string, string>();

  public constructor(
    private readonly cache: Cache,
    private readonly ttlSeconds: number,
  ) {}

  public async run(
    request: Request,
    scope: string,
    handle: () => Promise<Response>,
  ): Promise<Response> {
    const idempotencyKey = request.headers.get('idempotency-key');

    if (!idempotencyKey) {
      return idempotencyError(400, 'idempotency_key_required', 'Idempotency-Key header is required on all POST requests');
    }

    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return idempotencyError(400, 'invalid', `Idempotency-Key must be at most ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`);
    }

    const cacheKey = `${IDEMPOTENCY_CACHE_KEY_PREFIX}:${hash(`${scope}\n${new URL(request.url).pathname}\n${idempotencyKey}`)}`;
    const fingerprint = await getBodyFingerprint(request);

    // Claimed synchronously, so concurrent requests on this instance cannot
    // both pass the check.
    const inFlightFingerprint = this.inFlight.get(cacheKey);

    if (inFlightFingerprint !== undefined) {
      return replay({ fingerprint: inFlightFingerprint, inFlight: true }, fingerprint);
    }

    this.inFlight.set(cacheKey, fingerprint);

    try {
      const existing = await this.cache.get(cacheKey, ACPIdempotencyRecordSchema);

      if (existing) {
        return replay(existing, fingerprint);
      }

      await this.put(cacheKey, { fingerprint, inFlight: true }, IN_FLIGHT_TTL_SECONDS);

      const response = await handle();

      if (response.status >= 500) {
        await this.cache.invalidate([cacheKey]);
        return response;
      }

      await this.put(cacheKey, {
        fingerprint,
        inFlight: false,
        status: response.status,
        body: await response.clone().text(),
      }, this.ttlSeconds);

      return response;
    } catch (error) {
      await this.cache.invalidate([cacheKey]);
      throw error;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async put(cacheKey: string, record: ACPIdempotencyRecord, ttlSeconds: number): Promise<void> {
    await this.cache.invalidate([cacheKey]);
    await this.cache.put(cacheKey, record, { ttlSeconds, dependencyIds: [cacheKey] });
  }
}

function replay(record: ACPIdempotencyRecord, fingerprint: string): Response {
  if (record.fingerprint !== fingerprint) {
    return idempotencyError(422, 'idempotency_conflict', 'Idempotency-Key has already been used with a different request body');
  }

  if (record.inFlight) {
    return idempotencyError(
      409,
      'idempotency_in_flight',
      'A request with this Idempotency-Key is currently being processed',
      { 'retry-after': String(RETRY_AFTER_SECONDS) },
    );
  }

  return new Response(record.body ?? null, {
    status: record.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'idempotent-replayed': 'true',
    },
  });
}

function idempotencyError(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ type: 'invalid_request', code, message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/**
 * Requests are equivalent when their bodies are semantically equal JSON
 * (RFC §6.2): key order and number formatting do not matter, while array
 * order and null-versus-absent do.
 */
async function getBodyFingerprint(request: Request): Promise<string> {
  const text = await request.clone().text();

  try {
    return hash(canonicalize(JSON.parse(text)));
  } catch {
    return hash(text);
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(Reflect.get(value, key))}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
