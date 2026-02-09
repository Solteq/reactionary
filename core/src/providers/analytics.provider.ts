import type { RequestContext } from '../schemas/session.schema.js';
import { BaseProvider } from './base.provider.js';
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

export abstract class AnalyticsProvider extends BaseProvider {
  protected override getResourceName(): string {
    return 'analytics';
  }

  public async track(event: AnalyticsMutation): Promise<void> {
    switch (event.event) {
      case 'product-summary-view':
        this.processProductSummaryView(event);
        break;
      case 'product-summary-click':
        this.processProductSummaryClick(event);
        break;
      case 'product-details-view':
        this.processProductDetailsView(event);
        break;
      case 'product-cart-add':
        this.processProductAddToCart(event);
        break;
      case 'purchase':
        this.processPurchase(event)
        break;
    }
  }

  protected async processProductSummaryView(event: AnalyticsMutationProductSummaryViewEvent) {
    // Default is no-op
  }

  protected async processProductSummaryClick(event: AnalyticsMutationProductSummaryClickEvent) {
    // Default is no-op
  }

  protected async processProductDetailsView(event: AnalyticsMutationProductDetailsViewEvent) {
    // Default is no-op
  }

  protected async processProductAddToCart(event: AnalyticsMutationProductAddToCartEvent) {
    // Default is no-op
  }

  protected async processPurchase(event: AnalyticsMutationPurchaseEvent) {
    // Default is no-op
  }
}

export class MulticastAnalyticsProvider extends AnalyticsProvider {
  protected providers: Array<AnalyticsProvider>;

  constructor(
    cache: Cache,
    requestContext: RequestContext,
    providers: Array<AnalyticsProvider>
  ) {
    super(cache, requestContext);

    this.providers = providers;
  }

  @Reactionary({
    inputSchema: AnalyticsMutationSchema,
  })
  public override async track(event: AnalyticsMutation) {
    for (const provider of this.providers) {
      provider.track(event);
    }
  }
}
