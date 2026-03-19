import type { RequestContext } from '../schemas/session.schema.js';
import { BaseCapability } from './base.capability.js';
import type { Cache } from '../cache/cache.interface.js';
import {
  AnalyticsMutationSchema,
  type AnalyticsMutation,
  type AnalyticsMutationProductAddToCartEvent,
  type AnalyticsMutationProductDetailsViewEvent,
  type AnalyticsMutationProductSummaryClickEvent,
  type AnalyticsMutationProductSummaryViewEvent,
  type AnalyticsMutationPurchaseEvent,
} from '../schemas/index.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';

export abstract class AnalyticsCapability extends BaseCapability {
  protected override getResourceName(): string {
    return 'analytics';
  }

  public async track(event: AnalyticsMutation): Promise<void> {
    switch (event.event) {
      case 'product-summary-view':
        await this.processProductSummaryView(event);
        break;
      case 'product-summary-click':
        await this.processProductSummaryClick(event);
        break;
      case 'product-details-view':
        await this.processProductDetailsView(event);
        break;
      case 'product-cart-add':
        await this.processProductAddToCart(event);
        break;
      case 'purchase':
        await this.processPurchase(event)
        break;
    }
  }

  protected async processProductSummaryView(_event: AnalyticsMutationProductSummaryViewEvent) {
    // Default is no-op
  }

  protected async processProductSummaryClick(_event: AnalyticsMutationProductSummaryClickEvent) {
    // Default is no-op
  }

  protected async processProductDetailsView(_event: AnalyticsMutationProductDetailsViewEvent) {
    // Default is no-op
  }

  protected async processProductAddToCart(_event: AnalyticsMutationProductAddToCartEvent) {
    // Default is no-op
  }

  protected async processPurchase(_event: AnalyticsMutationPurchaseEvent) {
    // Default is no-op
  }
}

export class MulticastAnalyticsCapability extends AnalyticsCapability {
  protected capabilities: Array<AnalyticsCapability>;

  constructor(
    cache: Cache,
    requestContext: RequestContext,
    capabilities: Array<AnalyticsCapability>
  ) {
    super(cache, requestContext);

    this.capabilities = capabilities;
  }

  @Reactionary({
    inputSchema: AnalyticsMutationSchema,
  })
  public override async track(event: AnalyticsMutation) {
    for (const capability of this.capabilities) {
      capability.track(event);
    }
  }
}
