import {
  AnalyticsProvider,
  productKey,
  summarizePlacedOrder,
  type AnalyticsProductRef,
  type ProductConcept,
  type ProductIdentifier,
  type ProductVariantIdentifier,
  searchOriginOf,
  type AnalyticsContext,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsPurpose,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { hash } from 'node:crypto';
import { UnomiAPI } from '../core/client.js';
import { conceptItemId, selectInterestConcepts, type InterestConcept } from '../core/concept-interest.js';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';

interface UnomiEvent {
  eventType: string;
  scope: string;
  target?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

/**
 * Sends behavioural events to Apache Unomi's context endpoint, attributed to the visitor's marketing profile.
 *
 * Interest in taxonomy concepts: after the events of a product view, product click, add to cart, order and content
 * view, one `concept_interest` event is sent per concept (see the README for the shape). The concept ids have to travel
 * in the events, as Unomi cannot resolve item data. The concepts of a product are its direct ones, found through the
 * analytics context. Impressions (search results, carousels) are no interest. A lookup that fails or a product without
 * concepts sends the events as before, without concept events.
 *
 * Events are attributed to the marketing identifier captured when the event was emitted. Without one there is no profile to
 * attribute to (Unomi would create a throwaway profile per request), so the event is ignored.
 */
export class UnomiAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = [
    'search-results-viewed',
    'product-carousel-viewed',
    'product-viewed',
    'product-clicked',
    'content-viewed',
    'cart-item-added',
    'order-placed',
    'user-logged-in',
  ];

  /** A CDP builds visitor profiles for personalization. */
  public readonly purpose: AnalyticsPurpose = 'marketing';

  protected readonly api: UnomiAPI;

  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: UnomiConfiguration,
  ) {
    super(cache, context);
    this.api = new UnomiAPI(config, context);
  }

  protected override getResourceName(): string {
    return 'unomi-analytics';
  }

  public async handle(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<AnalyticsOutcome | void> {
    const events = await this.toUnomiEvents(event, ctx);
    if (events.length === 0) {
      return 'ignored';
    }

    // A login is sent on the profile the visitor had before it, so Unomi can merge it with the logged in one.
    const profileId = event.type === 'user-logged-in'
      ? (event.payload.previousMarketingId?.key || event.context.marketingIdentifier.key)
      : event.context.marketingIdentifier.key;
    if (!profileId) {
      return 'ignored';
    }

    await this.postEvents(profileId, events);
    return 'accepted';
  }

  protected async toUnomiEvents(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<UnomiEvent[]> {
    const events = await this.toBaseEvents(event, ctx);
    // an event that sends nothing records no interest either, except a content view, which has no event of its own
    if (events.length === 0 && event.type !== 'content-viewed') {
      return events;
    }
    return [...events, ...(await this.conceptInterestEvents(event, ctx))];
  }

  /**
   * The concept_interest events of an event, in one batch with its other events. Never throws, interest is an
   * enrichment: whatever cannot be resolved is left out.
   */
  protected async conceptInterestEvents(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<UnomiEvent[]> {
    if (!this.config.conceptInterest) {
      return [];
    }
    try {
      switch (event.type) {
        case 'product-viewed':
          return this.interestEvents('product_view', await this.productInterest([event.payload.product], ctx, this.config.maxConceptsPerEvent), { productId: productKey(event.payload.product) });
        case 'product-clicked':
          return this.interestEvents('product_click', await this.productInterest([event.payload.product], ctx, this.config.maxConceptsPerEvent), { productId: productKey(event.payload.product) });
        case 'cart-item-added': {
          const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
          return line ? this.interestEvents('add_to_cart', await this.productInterest([line.product], ctx, this.config.maxConceptsPerEvent), { productId: line.product.key }) : [];
        }
        case 'order-placed': {
          const placed = summarizePlacedOrder(event.payload);
          if (!placed) {
            return [];
          }
          // the lines of an order only carry the variant, so the products are found by sku, once per sku
          const variants = new Map<string, ProductVariantIdentifier>();
          for (const item of placed.items) {
            variants.set(item.variant.sku, item.variant);
          }
          const looked = await Promise.all([...variants.values()].map((variant) => ctx.products.bySku(variant)));
          return this.interestEvents(
            'purchase',
            selectInterestConcepts(
              looked.map((result) => (result.success ? result.value.concepts : undefined)),
              { vocabularies: this.config.conceptInterestVocabularies, max: this.config.maxConceptsPerOrder },
            ),
            { orderId: placed.transactionId },
          );
        }
        case 'content-viewed': {
          const concepts = selectInterestConcepts([event.payload.concepts.map(toProductConcept)], {
            vocabularies: this.config.conceptInterestVocabularies,
            max: this.config.maxConceptsPerEvent,
          });
          return this.interestEvents('content_view', concepts, {
            contentId: event.payload.content.key,
            ...(event.payload.content.type ? { contentType: event.payload.content.type } : {}),
          });
        }
        default:
          return [];
      }
    } catch {
      return [];
    }
  }

  /**
   * The interest concepts of products, from the concepts on the product when the event carries the model and from
   * a lookup through the context otherwise. A product that cannot be resolved adds nothing.
   */
  protected async productInterest(
    products: AnalyticsProductRef[],
    ctx: AnalyticsContext,
    max: number,
  ): Promise<InterestConcept[]> {
    const lists: Array<ProductConcept[] | undefined> = [];
    const toLookUp: ProductIdentifier[] = [];
    for (const product of products) {
      if ('concepts' in product && Array.isArray(product.concepts)) {
        lists.push(product.concepts);
      } else {
        toLookUp.push({ key: productKey(product) });
      }
    }
    const looked = toLookUp.length > 0 ? await ctx.products.many(toLookUp) : [];
    for (const result of looked) {
      if (result.success) {
        lists.push(result.value.concepts);
      }
    }
    return selectInterestConcepts(lists, { vocabularies: this.config.conceptInterestVocabularies, max });
  }

  protected interestEvents(source: string, concepts: InterestConcept[], extra: Record<string, unknown> = {}): UnomiEvent[] {
    return concepts.map((concept) => ({
      eventType: 'concept_interest',
      scope: this.config.scope,
      target: { itemId: conceptItemId(concept.id, this.config.encodeConceptIdSlash), itemType: 'concept' },
      properties: { source, vocabulary: concept.vocabulary, ...extra },
    }));
  }

  protected async toBaseEvents(event: AnalyticsEvent, ctx: AnalyticsContext): Promise<UnomiEvent[]> {
    const scope = this.config.scope;

    switch (event.type) {
      case 'search-results-viewed':
      case 'product-carousel-viewed':
        return event.payload.products.map((product) => ({
          eventType: 'product_view',
          scope,
          target: { itemId: productKey(product), itemType: 'product' },
        }));

      case 'product-viewed':
        return [{ eventType: 'product_view', scope, target: { itemId: productKey(event.payload.product), itemType: 'product' } }];

      case 'product-clicked': {
        const search = searchOriginOf(event.origin);
        return [
          {
            eventType: 'selectItem',
            scope,
            target: { itemId: productKey(event.payload.product), itemType: 'product' },
            properties: search ? { index: search.position, searchTerm: search.identifier.term } : undefined,
          },
        ];
      }

      case 'cart-item-added': {
        const line = event.payload.cart.items.find((item) => item.variant.sku === event.payload.variant.sku);
        if (!line) {
          return [];
        }
        const product = await ctx.products.byId(line.product);
        return [
          {
            eventType: 'addToCart',
            scope,
            target: {
              itemId: line.product.key,
              itemType: 'product',
              customItemType: 'product',
              properties: {
                sku: line.variant.sku,
                price: line.price.unitPrice.value,
                currency: line.price.unitPrice.currency,
                quantity: event.payload.quantity,
                ...(product.success ? { productName: product.value.name } : {}),
              },
            },
          },
        ];
      }

      case 'order-placed': {
        const placed = summarizePlacedOrder(event.payload);
        if (!placed) {
          return [];
        }
        return [
          {
            eventType: 'purchaseComplete',
            scope,
            target: { itemId: placed.transactionId, itemType: 'order' },
            properties: {
              orderId: placed.transactionId,
              totalAmount: placed.price.grandTotal.value,
              currency: placed.price.grandTotal.currency,
              itemCount: placed.items.length,
              items: placed.items.map((item) => ({
                sku: item.variant.sku,
                quantity: item.quantity,
                price: item.price.unitPrice.value,
              })),
            },
          },
        ];
      }

      case 'user-logged-in': {
        const identity = event.payload.identity;
        return [
          {
            eventType: 'login',
            scope,
            // An opaque hash: the CDP should not receive the backend user id itself.
            properties: identity.type === 'Anonymous' ? undefined : { userId: hash('sha256', identity.id.userId) },
          },
        ];
      }

      default:
        return [];
    }
  }

  protected async postEvents(profileId: string, events: UnomiEvent[]): Promise<void> {
    const response = await this.api.postEvent({
      source: {
        itemType: 'page',
        scope: this.config.scope,
        itemId: 'backend',
      },
      profileId,
      events,
    });

    if (!response.ok) {
      throw new Error(`Unomi event request failed with status ${response.status}`);
    }
  }
}

/**
 * A concept id from a payload as the minimal concept the selection works on: no parents, so all are direct.
 */
function toProductConcept(id: string): ProductConcept {
  const separator = id.indexOf('/');
  return {
    identifier: { key: id },
    vocabulary: separator > 0 ? id.slice(0, separator) : '',
    name: id,
  };
}
