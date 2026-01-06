import type { AnalyticsProvider } from "../providers/analytics.provider.js";
import type { ProductProvider } from "../providers/product.provider.js";
import type { ProductSearchProvider } from "../providers/product-search.provider.js";
import type { IdentityProvider } from '../providers/identity.provider.js';
import type { CartProvider } from "../providers/cart.provider.js";
import type { PriceProvider } from "../providers/price.provider.js";
import type { InventoryProvider } from "../providers/inventory.provider.js";
import type { Cache } from "../cache/cache.interface.js";
import type { CategoryProvider } from "../providers/category.provider.js";
import type { CheckoutProvider, OrderProvider, ProfileProvider, StoreProvider } from "../providers/index.js";
import type { OrderSearchProvider } from "../providers/order-search.provider.js";

export interface Client {
    product: ProductProvider,
    productSearch: ProductSearchProvider,
    identity: IdentityProvider,
    cache: Cache,
    cart: CartProvider,
    checkout: CheckoutProvider,
    analytics: Array<AnalyticsProvider>,
    price: PriceProvider,
    inventory: InventoryProvider,
    category: CategoryProvider,
    profile: ProfileProvider,
    store: StoreProvider,
    order: OrderProvider,
    orderSearch: OrderSearchProvider,
}

