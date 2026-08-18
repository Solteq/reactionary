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
  Reactionary,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import { SESSION_KEY_PERSONALIZATION_ID } from '../core/session-keys.js';

export class HclAnalyticsCapability extends AnalyticsCapability {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: AnalyticsMutationSchema,
    outputSchema: AnalyticsResultSchema,
  })
  public override async track(
    event: AnalyticsMutation,
  ): Promise<AnalyticsResult> {
    return super.track(event);
  }

  protected override async processProductSummaryView(
    event: AnalyticsMutationProductSummaryViewEvent,
  ): Promise<AnalyticsResult> {
    try {
      for (const product of event.products) {
        await this.fireEvent({ productId: product.key });
      }
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processProductSummaryClick(
    event: AnalyticsMutationProductSummaryClickEvent,
  ): Promise<AnalyticsResult> {
    try {
      await this.fireEvent({ productId: event.product.key });
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processProductDetailsView(
    event: AnalyticsMutationProductDetailsViewEvent,
  ): Promise<AnalyticsResult> {
    try {
      await this.fireEvent({ productId: event.product.key });
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processProductAddToCart(
    event: AnalyticsMutationProductAddToCartEvent,
  ): Promise<AnalyticsResult> {
    try {
      await this.fireEvent({ productId: event.product.key });
      return this.accepted();
    } catch {
      return this.rejected();
    }
  }

  protected override async processPurchase(
    event: AnalyticsMutationPurchaseEvent,
  ): Promise<AnalyticsResult> {
    try {
      for (const item of event.order.items) {
        await this.fireEvent({ productId: item.variant.sku });
      }
      return this.accepted();
    } catch {
      return this.rejected();
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
