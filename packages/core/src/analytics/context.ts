import type { CartCapability } from '../capabilities/cart.capability.js';
import type { CategoryCapability } from '../capabilities/category.capability.js';
import type { CompanyCapability } from '../capabilities/company.capability.js';
import type { IdentityCapability } from '../capabilities/identity.capability.js';
import type { InventoryCapability } from '../capabilities/inventory.capability.js';
import type { OrderCapability } from '../capabilities/order.capability.js';
import type { PersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import type { PriceCapability } from '../capabilities/price.capability.js';
import type { ProductCapability } from '../capabilities/product.capability.js';
import type { ProfileCapability } from '../capabilities/profile.capability.js';
import type { StoreCapability } from '../capabilities/store.capability.js';
import type {
    Cart,
    Category,
    CategoryIdentifier,
    Company,
    GenericError,
    Identity,
    Inventory,
    NotFoundError,
    OrderIdentifier,
    PersonalizationProfile,
    Price,
    Product,
    ProductIdentifier,
    ProductVariantIdentifier,
    Profile,
    RequestContext,
    Result,
    Store,
    StoreIdentifier,
    Order,
} from '../schemas/index.js';
import { error, success } from '../schemas/result.js';

/**
 * The capabilities lookups are bound to. Structural, so the client's own capabilities satisfy it and tests can pass stubs.
 * Anything left out answers lookups with an error Result.
 */
export interface AnalyticsLookupCapabilities {
    product?: Pick<ProductCapability, 'getById' | 'getBySKU'>;
    category?: Pick<CategoryCapability, 'getById' | 'getBreadcrumbPathToCategory'>;
    price?: Pick<PriceCapability, 'getCustomerPrice' | 'getListPrice'>;
    inventory?: Pick<InventoryCapability, 'getBySKU'>;
    cart?: Pick<CartCapability, 'getActiveCartId' | 'getById'>;
    order?: Pick<OrderCapability, 'getById'>;
    store?: Pick<StoreCapability, 'getById'>;
    identity?: Pick<IdentityCapability, 'getSelf'>;
    profile?: Pick<ProfileCapability, 'getById'>;
    personalizationProfile?: Pick<PersonalizationProfileCapability, 'getPersonalizationProfile'>;
    company?: Pick<CompanyCapability, 'getById'>;
}

export interface AnalyticsPrices {
    customer?: Price;
    list?: Price;
}

/**
 * Read-only lookups handed to analytics subscribers so they can enrich events lazily.
 *
 * Every lookup goes through the client's own decorated capabilities (so caching applies), is memoized for the lifetime of
 * this context (one flush) and returns a Result. Subscribers should degrade by sending fewer fields, not by dropping the event.
 * There is no mutation access, and the self.* lookups only ever resolve the current session.
 */
export interface AnalyticsContext {
    readonly products: {
        byId(id: ProductIdentifier): Promise<Result<Product>>;
        bySku(variant: ProductVariantIdentifier): Promise<Result<Product>>;
        /** Index-aligned with the input. Concurrency-limited. */
        many(ids: ProductIdentifier[]): Promise<Array<Result<Product>>>;
    };
    readonly categories: {
        byId(id: CategoryIdentifier): Promise<Result<Category, NotFoundError>>;
        path(id: CategoryIdentifier): Promise<Result<Category[]>>;
    };
    readonly prices: {
        forSku(variant: ProductVariantIdentifier): Promise<Result<AnalyticsPrices>>;
    };
    readonly inventory: {
        /** Looks up the fulfilment center of the request's store first. */
        forSku(variant: ProductVariantIdentifier): Promise<Result<Inventory>>;
    };
    readonly cart: {
        active(): Promise<Result<Cart>>;
    };
    readonly orders: {
        byId(id: OrderIdentifier): Promise<Result<Order, NotFoundError>>;
    };
    readonly stores: {
        byId(id: StoreIdentifier): Promise<Result<Store, NotFoundError>>;
    };
    readonly self: {
        identity(): Promise<Result<Identity>>;
        profile(): Promise<Result<Profile>>;
        personalization(): Promise<Result<PersonalizationProfile>>;
        /** Best effort: the company of the active cart, as core has no current company on the request context. */
        company(): Promise<Result<Company>>;
    };
}

export interface AnalyticsContextDependencies {
    capabilities: AnalyticsLookupCapabilities;
    requestContext: RequestContext;
    /** Maximum parallel product lookups in `products.many`. Defaults to 5. */
    concurrency?: number;
}

const DEFAULT_CONCURRENCY = 5;

function notConfigured(name: string) {
    return error<GenericError>({ type: 'Generic', message: `The ${name} capability is not configured, so analytics cannot look it up` });
}

function notFound(identifier: unknown) {
    return error<NotFoundError>({ type: 'NotFound', identifier });
}

function memoize<A, V>(fn: (arg: A) => Promise<V>, keyOf: (arg: A) => string): (arg: A) => Promise<V> {
    const cache = new Map<string, Promise<V>>();
    return (arg) => {
        const key = keyOf(arg);
        const hit = cache.get(key);
        if (hit) {
            return hit;
        }
        const pending = fn(arg);
        cache.set(key, pending);
        return pending;
    };
}

function memoizeOnce<V>(fn: () => Promise<V>): () => Promise<V> {
    let pending: Promise<V> | undefined;
    return () => (pending ??= fn());
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

/**
 * Creates a context with fresh memoization. The dispatcher creates one per flush.
 */
export function createAnalyticsContext(dependencies: AnalyticsContextDependencies): AnalyticsContext {
    const { capabilities, requestContext } = dependencies;
    const concurrency = Math.max(1, dependencies.concurrency ?? DEFAULT_CONCURRENCY);

    const productById = memoize(
        async (id: ProductIdentifier): Promise<Result<Product>> =>
            capabilities.product ? capabilities.product.getById({ identifier: id }) : notConfigured('product'),
        (id) => id.key,
    );
    const productBySku = memoize(
        async (variant: ProductVariantIdentifier): Promise<Result<Product>> =>
            capabilities.product ? capabilities.product.getBySKU({ variant }) : notConfigured('product'),
        (variant) => variant.sku,
    );
    const categoryById = memoize(
        async (id: CategoryIdentifier): Promise<Result<Category, NotFoundError>> =>
            capabilities.category ? capabilities.category.getById({ id }) : notConfigured('category'),
        (id) => id.key,
    );
    const categoryPath = memoize(
        async (id: CategoryIdentifier): Promise<Result<Category[]>> =>
            capabilities.category ? capabilities.category.getBreadcrumbPathToCategory({ id }) : notConfigured('category'),
        (id) => id.key,
    );
    const pricesForSku = memoize(
        async (variant: ProductVariantIdentifier): Promise<Result<AnalyticsPrices>> => {
            if (!capabilities.price) {
                return notConfigured('price');
            }
            const [customer, list] = await Promise.all([
                capabilities.price.getCustomerPrice({ variant }),
                capabilities.price.getListPrice({ variant }),
            ]);
            if (!customer.success && !list.success) {
                return customer;
            }
            return success({
                customer: customer.success ? customer.value : undefined,
                list: list.success ? list.value : undefined,
            });
        },
        (variant) => variant.sku,
    );
    const storeById = memoize(
        async (id: StoreIdentifier): Promise<Result<Store, NotFoundError>> =>
            capabilities.store ? capabilities.store.getById({ identifier: id }) : notConfigured('store'),
        (id) => id.key,
    );
    const inventoryForSku = memoize(
        async (variant: ProductVariantIdentifier): Promise<Result<Inventory>> => {
            if (!capabilities.inventory) {
                return notConfigured('inventory');
            }
            const store = await storeById(requestContext.storeIdentifier);
            if (!store.success) {
                return store;
            }
            return capabilities.inventory.getBySKU({ variant, fulfilmentCenter: store.value.fulfillmentCenter });
        },
        (variant) => variant.sku,
    );
    const activeCart = memoizeOnce(
        async (): Promise<Result<Cart>> => {
            if (!capabilities.cart) {
                return notConfigured('cart');
            }
            const id = await capabilities.cart.getActiveCartId();
            if (!id.success) {
                return id;
            }
            return capabilities.cart.getById({ cart: id.value });
        },
    );
    const orderById = memoize(
        async (id: OrderIdentifier): Promise<Result<Order, NotFoundError>> =>
            capabilities.order ? capabilities.order.getById({ order: id }) : notConfigured('order'),
        (id) => id.key,
    );
    const selfIdentity = memoizeOnce(
        async (): Promise<Result<Identity>> =>
            capabilities.identity ? capabilities.identity.getSelf({}) : notConfigured('identity'),
    );
    const selfProfile = memoizeOnce(
        async (): Promise<Result<Profile>> => {
            if (!capabilities.profile) {
                return notConfigured('profile');
            }
            const identity = requestContext.session.identityContext.identity;
            if (identity.type === 'Anonymous') {
                return notFound(identity);
            }
            return capabilities.profile.getById({ identifier: identity.id });
        },
    );
    const selfPersonalization = memoizeOnce(
        async (): Promise<Result<PersonalizationProfile>> => {
            if (!capabilities.personalizationProfile) {
                return notConfigured('personalizationProfile');
            }
            const marketing = requestContext.session.marketingContext.identifier;
            return capabilities.personalizationProfile.getPersonalizationProfile({
                identity: requestContext.session.identityContext.identity,
                personalizationProfileIdentifier: marketing.key ? marketing : undefined,
            });
        },
    );
    const selfCompany = memoizeOnce(
        async (): Promise<Result<Company>> => {
            if (!capabilities.company) {
                return notConfigured('company');
            }
            const cart = await activeCart();
            if (!cart.success) {
                return cart;
            }
            if (!cart.value.company) {
                return notFound(cart.value.identifier);
            }
            return capabilities.company.getById({ identifier: cart.value.company });
        },
    );

    return {
        products: {
            byId: productById,
            bySku: productBySku,
            many: (ids) => mapLimit(ids, concurrency, productById),
        },
        categories: { byId: categoryById, path: categoryPath },
        prices: { forSku: pricesForSku },
        inventory: { forSku: inventoryForSku },
        cart: { active: () => activeCart() },
        orders: { byId: orderById },
        stores: { byId: storeById },
        self: {
            identity: () => selfIdentity(),
            profile: () => selfProfile(),
            personalization: () => selfPersonalization(),
            company: () => selfCompany(),
        },
    };
}
