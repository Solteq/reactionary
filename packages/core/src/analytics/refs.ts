import type { AnalyticsCategoryRef, AnalyticsProductRef, AnalyticsStoreRef } from '../schemas/index.js';

/**
 * Events accept a model or just its identifier. These return the key either way, so providers do not
 * need to know which one the storefront passed.
 */
export function productKey(ref: AnalyticsProductRef): string {
    return 'key' in ref ? ref.key : ref.identifier.key;
}

export function categoryKey(ref: AnalyticsCategoryRef): string {
    return 'key' in ref ? ref.key : ref.identifier.key;
}

export function storeKey(ref: AnalyticsStoreRef): string {
    return 'key' in ref ? ref.key : ref.identifier.key;
}
