import {
  AnalyticsCapability,
  AnalyticsMutationSchema,
  AnalyticsResultSchema,
  type AnalyticsMutation,
  type AnalyticsMutationProductAddToCartEvent,
  type AnalyticsMutationProductDetailsViewEvent,
  type AnalyticsMutationProductSummaryClickEvent,
  type AnalyticsMutationProductSummaryViewEvent,
  type AnalyticsMutationPurchaseEvent,
  type AnalyticsResult,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { Reactionary } from '@reactionary/core';
import { UnomiAPI } from '../core/client.js';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';

export class UnomiAnalyticsCapability extends AnalyticsCapability {
  protected readonly api: UnomiAPI;

  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: UnomiConfiguration,
  ) {
    super(cache, context);
    this.api = new UnomiAPI(config, context);
  }

  @Reactionary({
    inputSchema: AnalyticsMutationSchema,
    outputSchema: AnalyticsResultSchema,
  })
  public override async track(event: AnalyticsMutation): Promise<AnalyticsResult> {
    return super.track(event);
  }

  protected override async processProductSummaryView(
    event: AnalyticsMutationProductSummaryViewEvent,
  ): Promise<AnalyticsResult> {

    const events = event.products.map((product) => ({
      eventType: 'product_view',
      scope: this.config.scope,
      target: {
        itemId: product.key,
        itemType: "product"
      }
    }));

    try {
      await this.postEvents(events);
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processProductSummaryClick(
    event: AnalyticsMutationProductSummaryClickEvent,
  ): Promise<AnalyticsResult> {
    const events = [
      {
          eventType: 'selectItem',
          scope: this.config.scope,
          targetProperties: {
            productId: event.product.key,
            sku: event.product.key,
            index: event.position
        }
      }
    ]
    try {
      await this.postEvents(events);
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processProductDetailsView(
    event: AnalyticsMutationProductDetailsViewEvent,
  ): Promise<AnalyticsResult> {
    const events = [
      {
          eventType: 'product_view',
          scope: this.config.scope,
          target: {
            itemId: event.product.key,
            itemType: "product"
        }
      }
    ]
    try {
      await this.postEvents(events);
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processProductAddToCart(
    event: AnalyticsMutationProductAddToCartEvent,
  ): Promise<AnalyticsResult> {
    const events = [
      {
          eventType: 'addToCart',
          scope: this.config.scope,
          target: {
            itemId: event.product.key,
            itemType: "product",
            customItemType: "product",
            properties: {
              price: 1,
              currency: this.context.languageContext.currencyCode ?? 'USD',
              productName: '-'
            }
          }
      }
    ]
    try {
      await this.postEvents(events);
      return this.accepted();
    } catch(e) {
      console.error('Error posting addToCart event to Unomi:', e);
      return this.rejected();
    }
  }

  protected override async processPurchase(
    event: AnalyticsMutationPurchaseEvent,
  ): Promise<AnalyticsResult> {
    const events = [
      {
          eventType: 'purchaseComplete',
          scope: this.config.scope,
          targetProperties: {
            totalAmount: event.order.price.grandTotal.value,
            currency: event.order.price.grandTotal.currency,
            itemCount: event.order.items.length,
          },
      }
    ]
    try {
      await this.postEvents(events);
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected async postEvents(
    events: Array<unknown>,
  ) : Promise<void> {
    const profileId = this.context.session.marketingContext.identifier.key;

    const source = {
      itemType: 'page',
      scope: this.config.scope,
      itemId: 'backend'
    }

    const payload = {
      source,
      profileId,
      events
    }
    const s = JSON.stringify(payload, null, 2);
    console.dir(payload, { depth: null });
    const response = await this.api.postEvent(payload);

    if (!response.ok) {
      throw new Error(`Unomi event request failed with status ${response.status}`);
    }
  }
}
