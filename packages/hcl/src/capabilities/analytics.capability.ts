import {
  AnalyticsProvider,
  productKey,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsPurpose,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import { SESSION_KEY_PERSONALIZATION_ID } from '../core/session-keys.js';

/**
 * Reports product interactions to HCL Commerce's event endpoint, which feeds its personalization. HCL only needs the
 * product (or, for purchases, the sku) and the personalization id of the session.
 *
 * The personalization id is read from the session when the event is sent, as the HCL client does for its own requests,
 * so it is the one HCL currently has for the session even if a login happened after the event was emitted.
 */
export class HclAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'search-results-viewed',
    'product-carousel-viewed',
    'product-clicked',
    'product-viewed',
    'cart-item-added',
    'order-placed',
  ];

  public readonly purpose: AnalyticsPurpose = 'analytics';

  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
  ) {
    super(cache, context);
  }

  protected override getResourceName(): string {
    return 'hcl-analytics';
  }

  public async handle(event: AnalyticsEvent): Promise<AnalyticsOutcome | void> {
    switch (event.type) {
      case 'search-results-viewed':
      case 'product-carousel-viewed':
        // One event per product, sent in order, as HCL has no batch endpoint.
        for (const product of event.payload.products) {
          await this.fireEvent({ productId: productKey(product) });
        }
        return 'accepted';

      case 'product-clicked':
      case 'product-viewed':
        await this.fireEvent({ productId: productKey(event.payload.product) });
        return 'accepted';

      case 'cart-item-added': {
        const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
        await this.fireEvent({ productId: line?.product.key ?? event.payload.variant.sku });
        return 'accepted';
      }

      case 'order-placed':
        for (const item of event.payload.order.items) {
          await this.fireEvent({ productId: item.variant.sku });
        }
        return 'accepted';

      default:
        return 'ignored';
    }
  }

  protected async fireEvent(extra: Record<string, string>): Promise<void> {
    await this.client.callPost<unknown>(
      this.getEventUrl(),
      this.getEventBody(extra),
    );
  }

  protected getEventUrl(): string {
    return `${this.client.transactionBaseUrl}/event`;
  }

  protected getEventBody(extra: Record<string, string>): Record<string, string> {
    const personalizationID = this.context.session[
      SESSION_KEY_PERSONALIZATION_ID
    ] as string | undefined;

    const body: Record<string, string> = { ...extra };
    if (personalizationID) {
      body['personalizationID'] = personalizationID;
    }
    return body;
  }
}
