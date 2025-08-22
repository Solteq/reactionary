import { BaseQuery } from "../schemas/queries/base.query";
import { BaseProvider } from "../providers/base.provider";
import { AnalyticsQuery } from "../schemas/queries/analytics.query";
import { InventoryQuery } from "../schemas/queries/inventory.query";
import { ProductQuery, ProductQueryById, ProductQueryBySlug } from "../schemas/queries/product.query";
import { PriceQuery } from "../schemas/queries/price.query";
import { SearchQuery } from "../schemas/queries/search.query";
import { CartQuery } from "../schemas/queries/cart.query";
import { IdentityQuery } from "../schemas/queries/identity.query";
import { Session } from "../schemas/session.schema";
import { BaseMutation } from "../schemas/mutations/base.mutation";
import * as crypto from 'crypto';

export interface CachingStrategyEvaluation {
    key: string;
    cacheDurationInSeconds: number;
    canCache: boolean;
}

export interface CachingStrategy {
    get(query: BaseQuery, session: Session, provider: BaseProvider): CachingStrategyEvaluation;
    getInvalidationKeys(mutation: BaseMutation, session: Session, provider: BaseProvider): string[];
}

export class UnifiedCachingStrategy implements CachingStrategy {
    constructor() {
        // Singleton strategy - no provider-specific state
    }
    
    protected getProviderType(provider: BaseProvider): string {
        // Walk up the prototype chain to find the base provider type
        let proto = Object.getPrototypeOf(provider.constructor);
        while (proto && proto.name !== 'BaseProvider') {
            const name = proto.name;
            if (name.endsWith('Provider')) {
                return name;
            }
            proto = Object.getPrototypeOf(proto);
        }
        return 'UnknownProvider';
    }

    public get(query: BaseQuery, session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        const providerType = this.getProviderType(provider);
        
        // Check global caching controls first
        if (!this.isGlobalCachingEnabled()) {
            return {
                key: '',
                cacheDurationInSeconds: 0,
                canCache: false
            };
        }

        // Dispatch based on provider type (base class)
        switch (providerType) {
            case 'InventoryProvider':
                return this.getInventoryStrategy(query as InventoryQuery, session, provider);
                
            case 'ProductProvider':
                return this.getProductStrategy(query as ProductQuery, session, provider);
                
            case 'PriceProvider':
                return this.getPriceStrategy(query as PriceQuery, session, provider);
                
            case 'SearchProvider':
                return this.getSearchStrategy(query as SearchQuery, session, provider);
                
            case 'CartProvider':
                return this.getCartStrategy(query as CartQuery, session, provider);
                
            case 'IdentityProvider':
                return this.getIdentityStrategy(query as IdentityQuery, session, provider);
                
            case 'AnalyticsProvider':
                return this.getAnalyticsStrategy(query as AnalyticsQuery, session, provider);
        }
        
        // No caching for unknown provider types
        return {
            key: '',
            cacheDurationInSeconds: 0,
            canCache: false
        };
    }

    public getInvalidationKeys(mutation: BaseMutation, session: Session, provider: BaseProvider): string[] {
        const providerName = provider.constructor.name.toLowerCase();
        // Return cache keys that should be invalidated when this mutation occurs
        const keys: string[] = [];
        const mutationType = (mutation as any).mutation;

        switch (mutationType) {
            case 'updateProduct':
            case 'createProduct':
            case 'deleteProduct': {
                // Invalidate product and search caches
                const productId = (mutation as any).id || (mutation as any).slug;
                if (productId) {
                    keys.push(`${providerName}:product:id:${productId}`);
                    keys.push(`${providerName}:product:slug:${productId}`);
                    keys.push(`${providerName}:search:*`); // Wildcard for all search results
                }
                break;
            }
                
            case 'updateInventory': {
                const sku = (mutation as any).sku;
                if (sku) {
                    keys.push(`${providerName}:inventory:${sku}`);
                }
                break;
            }
                
            case 'updatePrice': {
                const priceSku = (mutation as any).sku;
                if (priceSku) {
                    keys.push(`${providerName}:price:${this.hashSku(priceSku)}`);
                }
                break;
            }
                
            case 'addToCart':
            case 'removeFromCart':
            case 'updateCart': {
                const userId = session.identity?.id;
                if (userId) {
                    keys.push(`${providerName}:cart:${userId}`);
                }
                break;
            }
        }

        return keys;
    }

    protected isGlobalCachingEnabled(): boolean {
        // Global caching controls - strategy is authoritative
        if (process.env['NODE_ENV'] === 'test' || process.env['DISABLE_CACHE'] === 'true') {
            return false;
        }
        
        // Check if Redis configuration is available
        return !!(process.env['UPSTASH_REDIS_REST_URL'] || process.env['REDIS_URL']);
    }

    // Provider-specific strategy methods - each returns complete caching evaluation
    protected getInventoryStrategy(query: InventoryQuery, _session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // All inventory providers use the same caching strategy by default
        // Can add provider-specific overrides here if needed
        return {
            key: `${providerName}:inventory:${query.sku}`,
            cacheDurationInSeconds: 60, // 1 minute - inventory changes frequently
            canCache: true
        };
    }

    protected getProductStrategy(query: ProductQuery, _session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // All product providers use the same caching strategy by default
        let key: string;
        if (query.query === 'slug') {
            key = `${providerName}:product:slug:${(query as ProductQueryBySlug).slug}`;
        } else if (query.query === 'id') {
            key = `${providerName}:product:id:${(query as ProductQueryById).id}`;
        } else {
            key = `${providerName}:product:${this.hashQuery(query)}`;
        }

        return {
            key,
            cacheDurationInSeconds: 300, // 5 minutes - products are moderately stable
            canCache: true
        };
    }

    protected getPriceStrategy(query: PriceQuery, _session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // All price providers use the same caching strategy by default
        return {
            key: `${providerName}:price:${this.hashSku(query.sku)}`,
            cacheDurationInSeconds: 180, // 3 minutes - prices change more often than products
            canCache: true
        };
    }

    protected getSearchStrategy(query: SearchQuery, _session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // Default strategy for all search providers
        let ttl = 600; // 10 minutes by default
        
        // Provider-specific overrides based on actual implementation class
        const implementationClass = provider.constructor.name;
        if (implementationClass === 'AlgoliaSearchProvider') {
            // Algolia has fast responses, can cache longer
            ttl = 900; // 15 minutes
        } else if (implementationClass === 'ElasticsearchProvider') {
            // Elasticsearch might have more dynamic data
            ttl = 300; // 5 minutes
        }
        
        return {
            key: `${providerName}:search:${this.hashSearch(query.search)}`,
            cacheDurationInSeconds: ttl,
            canCache: true
        };
    }

    protected getCartStrategy(query: CartQuery, session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // All cart providers use the same caching strategy by default
        const userId = session.identity?.id || 'anonymous';
        // Don't cache cart for authenticated users in development
        const canCache = process.env['NODE_ENV'] === 'production' || !session.identity?.id;
        
        return {
            key: `${providerName}:cart:${userId}:${this.hashQuery(query)}`,
            cacheDurationInSeconds: 30, // 30 seconds - cart needs to be fresh
            canCache
        };
    }

    protected getIdentityStrategy(query: IdentityQuery, session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // All identity providers use the same caching strategy by default
        const userId = session.identity?.id;
        const key = userId 
            ? `${providerName}:identity:${userId}`
            : `${providerName}:identity:anonymous`;
        
        // Only cache profiles for authenticated users
        const canCache = !!session.identity?.id;
        
        return {
            key,
            cacheDurationInSeconds: 180, // 3 minutes - user profiles don't change often
            canCache
        };
    }

    protected getAnalyticsStrategy(query: AnalyticsQuery, _session: Session, provider: BaseProvider): CachingStrategyEvaluation {
        const providerName = provider.constructor.name.toLowerCase();
        // All analytics providers use the same caching strategy by default
        // Cache analytics unless it's real-time data
        const canCache = !(query as any).realtime;
        
        return {
            key: `${providerName}:analytics:${this.hashAnalytics(query)}`,
            cacheDurationInSeconds: 1800, // 30 minutes - analytics can be cached longer
            canCache
        };
    }

    // Helper methods for hashing complex objects

    protected hashSku(sku: any): string {
        // Hash complex SKU objects (price queries with currency, customer group, etc.)
        return crypto.createHash('md5').update(JSON.stringify(sku)).digest('hex').substring(0, 12);
    }

    protected hashSearch(search: any): string {
        // Hash search parameters (term, filters, pagination, etc.)
        return crypto.createHash('md5').update(JSON.stringify(search)).digest('hex').substring(0, 12);
    }

    protected hashAnalytics(query: any): string {
        // Hash analytics query parameters
        const relevantFields = {
            type: query.type,
            dateRange: query.dateRange,
            filters: query.filters
        };
        return crypto.createHash('md5').update(JSON.stringify(relevantFields)).digest('hex').substring(0, 12);
    }

    protected hashQuery(query: BaseQuery): string {
        // Fallback hasher for unknown query types
        return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
    }
}

// Legacy alias for backward compatibility
export class BaseCachingStrategy extends UnifiedCachingStrategy {
    constructor() {
        super();
    }
}