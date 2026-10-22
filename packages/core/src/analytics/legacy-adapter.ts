import type {
    AnalyticsEventResult,
    AnalyticsMutation,
    GenericError,
    Result,
} from '../schemas/index.js';
import { error } from '../schemas/result.js';
import type { AnalyticsDispatcher, AnalyticsEmitOptions } from './dispatcher.js';
import { fromDirect, fromSearch } from './origins.js';

/**
 * Converts a legacy `track` event into the equivalent new event and enqueues it on the dispatcher, exactly like the
 * new helpers do. Nothing is dispatched or awaited here beyond the cart and product lookups `product-cart-add` needs.
 *
 * A legacy event can carry the visitor's `personalizationProfile`. It identifies the visitor for that event only, as it did
 * before; the new helpers take no profile and use `session.marketingContext`.
 */
export async function emitLegacyAnalyticsEvent(
    event: AnalyticsMutation,
    dispatcher: AnalyticsDispatcher,
): Promise<Result<AnalyticsEventResult>> {
    const identity: AnalyticsEmitOptions = event.personalizationProfile
        ? { marketingIdentifier: event.personalizationProfile.identifier }
        : {};

    switch (event.event) {
        case 'product-summary-view':
            return event.source
                ? dispatcher.emit('search-results-viewed', { search: event.source.identifier, products: event.products }, identity)
                : dispatcher.emit('product-carousel-viewed', { carousel: { carouselName: 'unknown' }, products: event.products }, identity);

        case 'product-summary-click':
            return dispatcher.emit(
                'product-clicked',
                {
                    product: event.product,
                    origin: event.source ? fromSearch(event.source.identifier, event.position) : fromDirect(),
                },
                identity,
            );

        case 'product-details-view':
            return dispatcher.emit('product-viewed', { product: event.product }, identity);

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
            return dispatcher.emit(
                'cart-item-added',
                {
                    cart: cart.value,
                    variant: { sku: product.value.mainVariant.identifier.sku },
                    quantity: 1,
                    // The legacy source carries no position, only the search that led here.
                    origin: event.source ? fromSearch(event.source.identifier, 0) : undefined,
                },
                identity,
            );
        }

        case 'purchase':
            return dispatcher.emit('order-placed', { order: event.order }, identity);

        default:
            return error<GenericError>({ type: 'Generic', message: 'Unsupported legacy analytics event' });
    }
}
