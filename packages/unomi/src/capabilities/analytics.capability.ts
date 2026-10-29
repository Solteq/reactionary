import {
  AnalyticsProvider,
  type AnalyticsContext,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsPurpose,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { UnomiAPI } from '../core/client.js';
import { eurRate } from '../core/fx.js';
import { UnomiEventMapper, type UnomiEvent } from '../core/mapper.js';
import { unomiItemId } from '../contract/index.js';
import { UnomiConfigurationSchema, type UnomiConfiguration, type UnomiConfigurationInput } from '../schema/configuration.schema.js';

/** The events that can carry an amount and so need an EUR rate. The rest do not wait for the exchange rates. */
const MONEY_EVENTS: ReadonlySet<AnalyticsEventType> = new Set<AnalyticsEventType>([
  'product-viewed',
  'product-clicked',
  'cart-item-added',
  'cart-item-removed',
  'coupon-applied',
  'checkout-started',
  'order-placed',
  'quote-requested',
  'order-reordered',
  'wishlist-item-added',
  'back-in-stock-requested',
  'review-submitted',
  'product-shared',
]);

/**
 * Sends the behaviour of a visitor to Apache Unomi's context endpoint, attributed to the visitor's marketing profile.
 *
 * One reactionary event becomes one Unomi event of the contract in `contract/` (generate its JSON schemas with
 * `reactionary-unomi-schemas`). Product, category, store and price data that the event does not carry is looked up through the
 * analytics context, and amounts get an EUR counterpart at the ECB rate of the day. Unomi drops an event that does not match its
 * schema without a word, so an event is checked against the contract before it is sent, and left out with a warning if it fails.
 *
 * Not sent: impressions (search results, carousels, promotion views), quantity changes, cart views, shipping and payment steps,
 * rejected coupons, logouts, profile updates, consent changes and custom events.
 *
 * Events are attributed to the marketing identifier captured when the event was emitted. Without one there is no profile to
 * attribute to (Unomi would create a throwaway profile per request), so the event is ignored. A login is sent on the profile the
 * visitor had before it. Bots are left out.
 */
export class UnomiAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'page-viewed',
    'product-viewed',
    'product-clicked',
    'category-viewed',
    'content-viewed',
    'promotion-clicked',
    'cart-item-added',
    'cart-item-removed',
    'coupon-applied',
    'checkout-started',
    'order-placed',
    'quote-requested',
    'order-reordered',
    'wishlist-item-added',
    'back-in-stock-requested',
    'store-selected',
    'review-submitted',
    'product-shared',
    'newsletter-subscribed',
    'user-registered',
    'company-registered',
    'experiment-exposed',
    'trait-declared',
    'user-logged-in',
  ];

  /** A CDP builds visitor profiles for personalization. */
  public readonly purpose: AnalyticsPurpose = 'marketing';

  protected readonly api: UnomiAPI;
  protected readonly config: UnomiConfiguration;

  /**
   * The configuration may leave out the keys that have a default, the defaults are applied here.
   */
  constructor(cache: Cache, context: RequestContext, config: UnomiConfigurationInput) {
    super(cache, context);
    this.config = UnomiConfigurationSchema.parse(config);
    this.api = new UnomiAPI(this.config, context);
  }

  protected override getResourceName(): string {
    return 'unomi-analytics';
  }

  public async handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void> {
    if (event.context.isBot) {
      return 'ignored';
    }
    // A login is sent on the profile the visitor had before it, so Unomi can merge it with the logged in one.
    const profileId = event.type === 'user-logged-in'
      ? (event.payload.previousMarketingId?.key || event.context.marketingIdentifier.key)
      : event.context.marketingIdentifier.key;
    // without a profile there is nothing to attribute to, and nothing worth looking products up for
    if (!profileId) {
      return 'ignored';
    }

    const rate = MONEY_EVENTS.has(event.type) ? await eurRate(event.context.currency, this.config) : undefined;
    const mapped = await new UnomiEventMapper(event, ctx, this.config, rate).map();
    if (!mapped) {
      return 'ignored';
    }

    await this.postEvents(profileId, event.context.sessionId, [mapped]);
    return 'accepted';
  }

  protected async postEvents(profileId: string, sessionId: string | undefined, events: UnomiEvent[]): Promise<void> {
    const response = await this.api.postEvent({
      source: { itemType: 'site', scope: this.config.scope, itemId: this.config.sourceId },
      profileId,
      // Unomi only takes ids of a certain form, an id of another form is replaced by a stable hash.
      ...(sessionId ? { sessionId: unomiItemId(sessionId) } : {}),
      events,
    });

    if (!response.ok) {
      throw new Error(`Unomi event request failed with status ${response.status}`);
    }
  }
}
