import type {
    AnalyticsEventResult,
    AnalyticsMutation,
    GenericError,
    Result,
} from '../schemas/index.js';
import { error } from '../schemas/result.js';
import type { AnalyticsDispatcher } from './dispatcher.js';
import { fromDirect, fromSearch } from './origins.js';

/**
 * Converts a legacy `track` event into the equivalent new event and enqueues it on the dispatcher, exactly like the
 * new helpers do. Nothing is dispatched or awaited here beyond the cart and product lookups `product-cart-add` needs.
 *
 * The legacy `personalizationProfile` travels as `properties.personalizationProfile` so providers that still
 * read it keep working.
 */
export async function emitLegacyAnalyticsEvent(
    event: AnalyticsMutation,
    dispatcher: AnalyticsDispatcher,
): Promise<Result<AnalyticsEventResult>> {
    const properties = event.personalizationProfile ? { personalizationProfile: event.personalizationProfile } : undefined;

    switch (event.event) {
        case 'product-summary-view':
            return event.source
                ? dispatcher.emit('search-results-viewed', { search: event.source.identifier, products: event.products, properties })
                : dispatcher.emit('product-carousel-viewed', { carousel: { carouselName: 'unknown' }, products: event.products, properties });

        case 'product-summary-click':
            return dispatcher.emit('product-clicked', {
                product: event.product,
                origin: event.source ? fromSearch(event.source.identifier, event.position) : fromDirect(),
                properties,
            });

        case 'product-details-view':
            return dispatcher.emit('product-viewed', { product: event.product, properties });

        case 'product-cart-add': {
            // The legacy event has no cart, variant or quantity, so resolve them the way providers would.
            const lookups = dispatcher.lookups();
            const [cart, product] = await Promise.all([lookups.cart.active(), lookups.products.byId(event.product)]);
            if (!cart.success) {
                return cart;
            }
            if (!product.success) {
                return product;
            }
            return dispatcher.emit('cart-item-added', {
                cart: cart.value,
                variant: { sku: product.value.mainVariant.identifier.sku },
                quantity: 1,
                // The legacy source carries no position, only the search that led here.
                origin: event.source ? fromSearch(event.source.identifier, 0) : undefined,
                properties,
            });
        }

        case 'purchase':
            return dispatcher.emit('order-placed', { order: event.order, properties });

        default:
            return error<GenericError>({ type: 'Generic', message: 'Unsupported legacy analytics event' });
    }
}
