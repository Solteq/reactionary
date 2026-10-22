import { searchOriginOf } from '../analytics/origins.js';
import { productKey } from '../analytics/refs.js';
import type {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsMutation,
  AnalyticsMutationProductAddToCartEvent,
  AnalyticsMutationProductDetailsViewEvent,
  AnalyticsMutationProductSummaryClickEvent,
  AnalyticsMutationProductSummaryViewEvent,
  AnalyticsMutationPurchaseEvent,
  AnalyticsOutcome,
  AnalyticsPurpose,
  AnalyticsResult,
} from '../schemas/index.js';
import { AnalyticsProvider } from './analytics.provider.js';

/**
 * Transitional base for providers that still implement the five legacy `process*` hooks. It adapts the new events
 * onto them so those providers keep working unchanged while they are ported to {@link AnalyticsProvider}.
 *
 * @deprecated Extend {@link AnalyticsProvider} and implement `handle` instead. This class is removed once the bundled
 * providers are ported.
 */
export abstract class LegacyAnalyticsProvider extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'search-results-viewed',
    'product-carousel-viewed',
    'product-clicked',
    'product-viewed',
    'cart-item-added',
    'order-placed',
  ];

  public readonly purpose: AnalyticsPurpose = 'analytics';

  public async handle(event: AnalyticsEvent): Promise<AnalyticsOutcome | void> {
    const mutation = toLegacyMutation(event);
    if (!mutation) {
      return;
    }
    const result = await this.track(mutation);
    return result.outcomes[0]?.outcome;
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

  protected async processProductSummaryView(_event: AnalyticsMutationProductSummaryViewEvent): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processProductSummaryClick(_event: AnalyticsMutationProductSummaryClickEvent): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processProductDetailsView(_event: AnalyticsMutationProductDetailsViewEvent): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processProductAddToCart(_event: AnalyticsMutationProductAddToCartEvent): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected async processPurchase(_event: AnalyticsMutationPurchaseEvent): Promise<AnalyticsResult> {
    return this.ignored();
  }

  protected accepted(): AnalyticsResult {
    return { outcomes: [{ provider: this.getResourceName(), outcome: 'accepted' }] };
  }

  protected ignored(): AnalyticsResult {
    return { outcomes: [{ provider: this.getResourceName(), outcome: 'ignored' }] };
  }

  protected rejected(): AnalyticsResult {
    return { outcomes: [{ provider: this.getResourceName(), outcome: 'rejected' }] };
  }
}

/**
 * Maps a new event onto the legacy mutation a `process*` hook expects. Undefined when the legacy API has no equivalent.
 */
export function toLegacyMutation(event: AnalyticsEvent): AnalyticsMutation | undefined {
  const marketing = event.context.marketingIdentifier;
  const personalizationProfile = marketing.key ? { identifier: marketing, segments: [], blurb: '' } : undefined;
  const search = searchOriginOf(event.origin);
  const source = search ? ({ type: 'search', identifier: search.identifier } as const) : undefined;

  switch (event.type) {
    case 'search-results-viewed':
      return {
        event: 'product-summary-view',
        products: event.payload.products.map((product) => ({ key: productKey(product) })),
        source: { type: 'search', identifier: event.payload.search },
        personalizationProfile,
      };
    case 'product-carousel-viewed':
      return {
        event: 'product-summary-view',
        products: event.payload.products.map((product) => ({ key: productKey(product) })),
        personalizationProfile,
      };
    case 'product-clicked':
      return {
        event: 'product-summary-click',
        product: { key: productKey(event.payload.product) },
        position: search?.position ?? 0,
        source,
        personalizationProfile,
      };
    case 'product-viewed':
      return { event: 'product-details-view', product: { key: productKey(event.payload.product) }, personalizationProfile };
    case 'cart-item-added': {
      const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
      return {
        event: 'product-cart-add',
        product: { key: line?.product.key ?? event.payload.variant.sku },
        source,
        personalizationProfile,
      };
    }
    case 'order-placed':
      return { event: 'purchase', order: event.payload.order, personalizationProfile };
    default:
      return undefined;
  }
}
