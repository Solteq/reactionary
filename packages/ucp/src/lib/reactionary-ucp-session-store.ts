import { SessionSchema, type Cache, type Session } from '@reactionary/core';
import * as z from 'zod';

const SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:session';
const IDEMPOTENCY_CACHE_KEY_PREFIX = 'reactionary:ucp:idempotency';
const CHECKOUT_SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:checkout-session';
const RESOURCE_SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:resource-session';
const ORDER_CACHE_KEY_PREFIX = 'reactionary:ucp:order';

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

const UCPConsentSourceSchema = z.enum(['business', 'platform']);

/**
 * Buyer consent per purpose (buyer consent extension): the spec's purpose
 * map ({ granted, source, segments }), or the flat booleans of earlier
 * versions still used by the conformance SDK (e.g. { marketing: true }).
 */
export const UCPBuyerConsentSchema = z.record(z.string(), z.union([
  z.boolean(),
  z.looseObject({
    granted: z.boolean(),
    source: UCPConsentSourceSchema,
    segments: z.record(z.string(), z.looseObject({
      granted: z.boolean(),
      source: UCPConsentSourceSchema,
    })).optional(),
  }),
]));

export const UCPCheckoutSessionStateSchema = z.looseObject({
  id: z.string(),
  cartId: z.string(),
  status: z.enum(['open', 'complete_in_progress', 'completed', 'canceled']),
  buyer: z.looseObject({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone_number: z.string().optional(),
    /** Round-tripped only; not persisted beyond the session yet. */
    consent: UCPBuyerConsentSchema.optional(),
  }).optional(),
  billingAddress: UCPPostalAddressStateSchema.optional(),
  destination: UCPPostalAddressStateSchema.optional(),
  selectedOptionId: z.string().optional(),
  /** The selected fulfillment option's title, as last shown to the agent. */
  selectedOptionTitle: z.string().optional(),
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

const UCPOrderLineItemReferenceSchema = z.object({
  id: z.string(),
  quantity: z.int(),
});

export const UCPFulfillmentEventSchema = z.looseObject({
  id: z.string(),
  occurred_at: z.iso.datetime({ offset: true }),
  type: z.string(),
  line_items: z.array(UCPOrderLineItemReferenceSchema.extend({ quantity: z.int().min(1) })),
  tracking_number: z.string().optional(),
  tracking_url: z.url().optional(),
  carrier: z.string().optional(),
  description: z.string().optional(),
});

export const UCPAdjustmentSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
  occurred_at: z.iso.datetime({ offset: true }),
  status: z.enum(['pending', 'completed', 'failed']),
  line_items: z.array(UCPOrderLineItemReferenceSchema).optional(),
  totals: z.array(z.looseObject({ type: z.string(), amount: z.int() })).optional(),
  description: z.string().optional(),
});

/**
 * What UCP knows about an order placed through a checkout session: its
 * origin, the fulfillment the agent selected, and (with testOrderUpdates)
 * the events and adjustments posted to it.
 */
export const UCPOrderStateSchema = z.looseObject({
  id: z.string(),
  checkoutSessionId: z.string(),
  /** The UCP session that completed the checkout and owns the order. */
  sessionId: z.string(),
  /** The UCP-Agent profile of the platform that completed the checkout. */
  agentProfile: z.string().optional(),
  /** The order webhook URL from the platform's profile, resolved at placement. */
  webhookUrl: z.string().optional(),
  destination: UCPPostalAddressStateSchema.optional(),
  fulfillmentTitle: z.string().optional(),
  events: z.array(UCPFulfillmentEventSchema).default([]),
  adjustments: z.array(UCPAdjustmentSchema).default([]),
});

export type UCPOrderState = z.output<typeof UCPOrderStateSchema>;

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

  public async getOrder(orderId: string): Promise<UCPOrderState | undefined> {
    return (
      (await this.cache.get(
        `${ORDER_CACHE_KEY_PREFIX}:${orderId}`,
        UCPOrderStateSchema,
      )) ?? undefined
    );
  }

  public async putOrder(state: UCPOrderState): Promise<void> {
    const key = `${ORDER_CACHE_KEY_PREFIX}:${state.id}`;

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
