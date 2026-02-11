import type { ProductProvider } from "../providers/product.provider.js";
import type { ProductSearchProvider } from "../providers/product-search.provider.js";
import type { IdentityProvider } from '../providers/identity.provider.js';
import type { CartProvider } from "../providers/cart.provider.js";
import type { PriceProvider } from "../providers/price.provider.js";
import type { InventoryProvider } from "../providers/inventory.provider.js";
import type { Cache } from "../cache/cache.interface.js";
import type { CategoryProvider } from "../providers/category.provider.js";
import type { AnalyticsProvider, CheckoutProvider, OrderProvider, ProfileProvider, StoreProvider } from "../providers/index.js";
import type { OrderSearchProvider } from "../providers/order-search.provider.js";
import type { ProductRecommendationsProvider } from "../providers/product-recommendations.provider.js";
import type { ProductAssociationsProvider } from "../providers/product-associations.provider.js";

export interface Client {
    product: ProductProvider,
    productSearch: ProductSearchProvider,
    productRecommendations: ProductRecommendationsProvider,
    productAssociations: ProductAssociationsProvider,
    identity: IdentityProvider,
    cache: Cache,
    cart: CartProvider,
    checkout: CheckoutProvider,
    analytics: AnalyticsProvider,
    price: PriceProvider,
    inventory: InventoryProvider,
    category: CategoryProvider,
    profile: ProfileProvider,
    store: StoreProvider,
    order: OrderProvider,
    orderSearch: OrderSearchProvider,
}

