import {
  AnalyticsProvider,
  type RequestContext,
  type Cache,
  type AnalyticsMutationProductSummaryViewEvent,
  type AnalyticsMutationProductSummaryClickEvent,
  type AnalyticsMutationProductDetailsViewEvent,
  type AnalyticsMutationProductAddToCartEvent,
  type AnalyticsMutationPurchaseEvent,
} from '@reactionary/core';
import type { GoogleAnalyticsConfiguration } from '../schema/configuration.schema.js';

export class GoogleAnalyticsAnalyticsProvider extends AnalyticsProvider {
  protected config: GoogleAnalyticsConfiguration;

  constructor(
    cache: Cache,
    context: RequestContext,
    configuration: GoogleAnalyticsConfiguration
  ) {
    super(cache, context);

    this.config = configuration;
  }

  protected override async processProductSummaryView(
    event: AnalyticsMutationProductSummaryViewEvent
  ) {
    const gaEvent = {
      client_id: this.context.session.identityContext.personalizationKey,
      user_id: this.context.session.identityContext.personalizationKey,
      events: [
        {
          name: 'view_item_list',
          params: {
            currency: this.context.languageContext.currencyCode,
            items: event.products.map((x) => {
              return {
                item_id: x.key,
              };
            }),
          },
        },
      ],
    };

    await this.sendEvent(gaEvent);
  }

  protected override async processProductSummaryClick(
    event: AnalyticsMutationProductSummaryClickEvent
  ) {
    const gaEvent = {
      client_id: this.context.session.identityContext.personalizationKey,
      user_id: this.context.session.identityContext.personalizationKey,
      events: [
        {
          name: 'select_item',
          params: {
            currency: this.context.languageContext.currencyCode,
            items: [
              {
                item_id: event.product.key,
                index: event.position,
              },
            ],
          },
        },
      ],
    };

    await this.sendEvent(gaEvent);
  }

  protected override async processProductDetailsView(
    event: AnalyticsMutationProductDetailsViewEvent
  ) {
    const gaEvent = {
      client_id: this.context.session.identityContext.personalizationKey,
      user_id: this.context.session.identityContext.personalizationKey,
      events: [
        {
          name: 'view_item',
          params: {
            currency: this.context.languageContext.currencyCode,
            items: [
              {
                item_id: event.product.key,
              },
            ],
          },
        },
      ],
    };

    await this.sendEvent(gaEvent);
  }

  protected override async processProductAddToCart(
    event: AnalyticsMutationProductAddToCartEvent
  ) {
    const gaEvent = {
      client_id: this.context.session.identityContext.personalizationKey,
      user_id: this.context.session.identityContext.personalizationKey,
      events: [
        {
          name: 'add_to_cart',
          params: {
            currency: this.context.languageContext.currencyCode,
            items: [
              {
                item_id: event.product.key,
              },
            ],
          },
        },
      ],
    };

    await this.sendEvent(gaEvent);
  }

  protected override async processPurchase(
    event: AnalyticsMutationPurchaseEvent
  ) {
    const gaEvent = {
      client_id: this.context.session.identityContext.personalizationKey,
      user_id: this.context.session.identityContext.personalizationKey,
      events: [
        {
          name: 'purchase',
          params: {
            currency: this.context.languageContext.currencyCode,
            transaction_id: event.order.identifier.key,
            value: event.order.price.grandTotal.value,
            tax: event.order.price.totalTax.value,
            shipping: event.order.price.totalShipping.value,
            items: event.order.items.map((item) => ({
              item_id: item.variant.sku,
              quantity: item.quantity,
              price: item.price.unitPrice.value,
            })),
          },
        },
      ],
    };

    await this.sendEvent(gaEvent);
  }

  protected async sendEvent(event: unknown) {
    const url = `${this.config.url}?measurement_id=${this.config.measurementId}&api_secret=${this.config.apiSecret}`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
  }
}
