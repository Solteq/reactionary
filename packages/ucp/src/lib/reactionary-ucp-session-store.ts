import { SessionSchema, type Cache, type Session } from '@reactionary/core';
import * as z from 'zod';

const SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:session';
const IDEMPOTENCY_CACHE_KEY_PREFIX = 'reactionary:ucp:idempotency';
const CHECKOUT_SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:checkout-session';
const RESOURCE_SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:resource-session';

const UCPPostalAddressStateSchema = z.looseObject({
  id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  street_address: z.string().optional(),
  extended_address: z.string().optional(),
  address_locality: z.string().optional(),
  address_region: z.string().optional(),
  address_country: z.string().optional(),
  postal_code: z.string().optional(),
  phone_number: z.string().optional(),
});

export const UCPCheckoutSessionStateSchema = z.looseObject({
  id: z.string(),
  cartId: z.string(),
  status: z.enum(['open', 'complete_in_progress', 'completed', 'canceled']),
  buyer: z.looseObject({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone_number: z.string().optional(),
  }).optional(),
  billingAddress: UCPPostalAddressStateSchema.optional(),
  destination: UCPPostalAddressStateSchema.optional(),
  selectedOptionId: z.string().optional(),
  instrument: z.looseObject({
    id: z.string(),
    handler_id: z.string(),
    type: z.string(),
  }).optional(),
  lastTotal: z.number().optional(),
  finalCheckoutId: z.string().optional(),
  orderId: z.string().optional(),
});

export type UCPCheckoutSessionState = z.infer<typeof UCPCheckoutSessionStateSchema>;

const UCPResourceSessionSchema = z.looseObject({ sessionId: z.string() });
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

  public async getCheckoutSession(
    checkoutSessionId: string,
  ): Promise<UCPCheckoutSessionState | undefined> {
    return (
      (await this.cache.get(
        `${CHECKOUT_SESSION_CACHE_KEY_PREFIX}:${checkoutSessionId}`,
        UCPCheckoutSessionStateSchema,
      )) ?? undefined
    );
  }

  public async putCheckoutSession(state: UCPCheckoutSessionState): Promise<void> {
    const key = `${CHECKOUT_SESSION_CACHE_KEY_PREFIX}:${state.id}`;

    await this.cache.invalidate([key]);
    await this.cache.put(key, state, {
      ttlSeconds: this.ttlSeconds,
      dependencyIds: [key],
    });
  }

  /**
   * Binds a created resource (cart or checkout session) to the UCP session
   * that owns its backend state. Agents address resources by id and rarely
   * echo the UCP session header, yet backends scope carts to the session's
   * (anonymous) identity, so later requests must resume the owning session.
   */
  public async bindResource(resourceId: string, sessionId: string): Promise<void> {
    await this.cache.put(
      `${RESOURCE_SESSION_CACHE_KEY_PREFIX}:${resourceId}`,
      { sessionId },
      { ttlSeconds: this.ttlSeconds, dependencyIds: [] },
    );
  }

  public async getResourceSession(resourceId: string): Promise<string | undefined> {
    const binding = await this.cache.get(
      `${RESOURCE_SESSION_CACHE_KEY_PREFIX}:${resourceId}`,
      UCPResourceSessionSchema,
    );

    return binding?.sessionId;
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
