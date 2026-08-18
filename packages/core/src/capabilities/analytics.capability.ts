import type { RequestContext } from '../schemas/session.schema.js';
import { BaseCapability } from './base.capability.js';
import type { Cache } from '../cache/cache.interface.js';
import {
  AnalyticsMutationSchema,
  AnalyticsResultSchema,
  type AnalyticsMutation,
  type AnalyticsMutationProductAddToCartEvent,
  type AnalyticsMutationProductDetailsViewEvent,
  type AnalyticsMutationProductSummaryClickEvent,
  type AnalyticsMutationProductSummaryViewEvent,
  type AnalyticsMutationPurchaseEvent,
  type AnalyticsResult,
} from '../schemas/index.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';

export abstract class AnalyticsCapability extends BaseCapability {
  protected override getResourceName(): string {
    return 'analytics';
  }

  public async track(event: AnalyticsMutation): Promise<AnalyticsResult> {
    switch (event.event) {
      case 'product-summary-view':
        return this.processProductSummaryView(event);
      case 'product-summary-click':
        return this.processProductSummaryClick(event);
      case 'product-details-view':
        return this.processProductDetailsView(event);
      case 'product-cart-add':
        return this.processProductAddToCart(event);
      case 'purchase':
        return this.processPurchase(event);
      default:
        return this.ignored();
    }
  }

  protected async processProductSummaryView(
    _event: AnalyticsMutationProductSummaryViewEvent,
  ): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processProductSummaryClick(
    _event: AnalyticsMutationProductSummaryClickEvent,
  ): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processProductDetailsView(
    _event: AnalyticsMutationProductDetailsViewEvent,
  ): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processProductAddToCart(
    _event: AnalyticsMutationProductAddToCartEvent,
  ): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processPurchase(
    _event: AnalyticsMutationPurchaseEvent,
  ): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected accepted(): AnalyticsResult {
    return {
      outcomes: [
        {
          provider: this.getResourceName(),
          outcome: 'accepted',
        },
      ],
    };
  }

  protected ignored(): AnalyticsResult {
    return {
      outcomes: [
        {
          provider: this.getResourceName(),
          outcome: 'ignored',
        },
      ],
    };
  }

  protected rejected(): AnalyticsResult {
    return {
      outcomes: [
        {
          provider: this.getResourceName(),
          outcome: 'rejected',
        },
      ],
    };
  }
}

export class MulticastAnalyticsCapability extends AnalyticsCapability {
  protected capabilities: Array<AnalyticsCapability>;

  constructor(
    cache: Cache,
    requestContext: RequestContext,
    capabilities: Array<AnalyticsCapability>,
  ) {
    super(cache, requestContext);

    this.capabilities = capabilities;
  }

  @Reactionary({
    inputSchema: AnalyticsMutationSchema,
    outputSchema: AnalyticsResultSchema,
  })
  public override async track(
    event: AnalyticsMutation,
  ): Promise<AnalyticsResult> {
    const tracks = [];
    for (const capability of this.capabilities) {
      tracks.push(capability.track(event));
    }

    const results = await Promise.all(tracks);

    return {
      outcomes: results.flatMap((result) => result.outcomes),
    };
  }
}
