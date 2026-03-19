import {
    ProductSearchProvider,
    ProductSearchQueryByTermSchema,
    type Cache,
    type RequestContext,
    type ProductSearchQueryByTerm,
    type ProductSearchResult,
    type ProductSearchResultItem,
    ImageSchema,
    ProductVariantIdentifierSchema,
    type ProductVariantIdentifier,
    ProductSearchResultItemVariantSchema,
    type ProductSearchResultItemVariant,
    type FacetIdentifier,
    type FacetValueIdentifier,
    type ProductSearchResultFacet,
    type ProductSearchResultFacetValue,
    Reactionary,
    ProductSearchResultSchema,
    type ProductSearchQueryCreateNavigationFilter,
    FacetValueIdentifierSchema,
    FacetIdentifierSchema,
    type Result,
    success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';

const debug = createDebug('reactionary:magento:search');

type MagentoProduct = any;

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
}

function buildMagentoImageUrl(config: MagentoConfiguration, file: string): string {
    const mediaUrl = (config as any).mediaUrl as string | undefined;
    if (mediaUrl) {
        return `${mediaUrl.replace(/\/+$/, '')}${file.startsWith('/') ? '' : '/'}${file}`;
    }

    const api = normalizeBaseUrl(config.apiUrl);
    const storeBase = api.replace(/\/rest.*$/i, '');
    return `${storeBase}/media/catalog/product${file.startsWith('/') ? '' : '/'}${file}`;
}

function getCustomAttribute(product: MagentoProduct, code: string): string | undefined {
    const list = product?.custom_attributes;
    if (!Array.isArray(list)) return undefined;
    const found = list.find((a: any) => a?.attribute_code === code);
    const value = found?.value;
    if (value === null || value === undefined) return undefined;
    return String(value);
}

export class MagentoSearchProvider extends ProductSearchProvider {
    protected config: MagentoConfiguration;

    constructor(
        config: MagentoConfiguration,
        cache: Cache,
        context: RequestContext,
        public client: MagentoClient
    ) {
        super(cache, context);
        this.config = config;
    }

    @Reactionary({
        inputSchema: ProductSearchQueryByTermSchema,
        outputSchema: ProductSearchResultSchema,
        cache: true,
        cacheTimeToLiveInSeconds: 300,
        currencyDependentCaching: false,
        localeDependentCaching: true,
    })
    public override async queryByTerm(
        payload: ProductSearchQueryByTerm
    ): Promise<Result<ProductSearchResult>> {
        const finalSearch = (payload.search.term || '').trim().replace('*', '');
        const pageSize = payload.search.paginationOptions.pageSize;
        const currentPage = payload.search.paginationOptions.pageNumber;

        const params = new URLSearchParams();

        // Filter group 0: search term (name LIKE %term%)
        let filterGroupIndex = 0;
        if (finalSearch) {
            params.set(
                `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][field]`,
                'name'
            );
            params.set(
                `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][value]`,
                `%${finalSearch}%`
            );
            params.set(
                `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][condition_type]`,
                'like'
            );
            filterGroupIndex++;
        }

        // Filter group 1: optional category filter
        if (payload.search.categoryFilter?.key) {
            debug(`Applying category filter: ${payload.search.categoryFilter.key}`);
            params.set(
                `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][field]`,
                'category_id'
            );
            params.set(
                `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][value]`,
                payload.search.categoryFilter.key
            );
            params.set(
                `searchCriteria[filterGroups][${filterGroupIndex}][filters][0][condition_type]`,
                'eq'
            );
            filterGroupIndex++;
        }

        params.set('searchCriteria[pageSize]', String(pageSize));
        params.set('searchCriteria[currentPage]', String(currentPage));

        const client = await this.client.getClient();
        const response = await client.store.product.search(params);

        const result = this.parsePaginatedResult(
            response,
            pageSize,
            currentPage
        );

        result.identifier = {
            ...payload.search,
        };

        if (debug.enabled) {
            debug(
                `Search for term "${payload.search.term}" returned ${response.items?.length ?? 0} products (page ${currentPage} of ${result.totalPages})`
            );
        }

        return success(result);
    }

    protected parsePaginatedResult(
        remote: { items: MagentoProduct[]; total_count: number },
        pageSize: number,
        currentPage: number
    ): ProductSearchResult {
        const items: ProductSearchResultItem[] = (remote.items || []).map((p) =>
            this.parseSingle(p)
        );

        const totalCount = remote.total_count ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        return {
            identifier: {
                facets: [],
                filters: [],
                paginationOptions: {
                    pageNumber: currentPage,
                    pageSize,
                },
                term: '',
            },
            pageNumber: currentPage,
            pageSize,
            totalCount,
            totalPages,
            items,
            facets: [],
        } satisfies ProductSearchResult;
    }

    protected parseSingle(body: MagentoProduct): ProductSearchResultItem {
        const idKey: string =
            body?.id !== undefined ? String(body.id) : String(body?.sku ?? '');
        const identifier = { key: idKey };
        const slug: string =
            getCustomAttribute(body, 'url_key') ??
            getCustomAttribute(body, 'url_path') ??
            '';
        const name: string = String(body?.name ?? body?.sku ?? '');

        const variants: ProductSearchResultItemVariant[] = [];
        if (body?.sku) {
            variants.push(this.parseVariant(body, body));
        }

        return {
            identifier,
            name,
            slug,
            variants,
        } satisfies ProductSearchResultItem;
    }

    protected override parseVariant(
        variant: MagentoProduct,
        product: MagentoProduct
    ): ProductSearchResultItemVariant {
        const media = product?.media_gallery_entries;
        const firstImage =
            Array.isArray(media) && media.length > 0 ? media[0]?.file : null;

        const img = firstImage
            ? ImageSchema.parse({
                sourceUrl: buildMagentoImageUrl(this.config, firstImage),
                altText: product?.name || undefined,
            })
            : ImageSchema.parse({
                sourceUrl: '',
                altText: product?.name || undefined,
            });

        return ProductSearchResultItemVariantSchema.parse({
            variant: ProductVariantIdentifierSchema.parse({
                sku: String(variant?.sku ?? ''),
            } satisfies ProductVariantIdentifier),
            image: img,
        } satisfies Partial<ProductSearchResultItemVariant>);
    }

    public override async createCategoryNavigationFilter(
        payload: ProductSearchQueryCreateNavigationFilter
    ): Promise<Result<FacetValueIdentifier>> {
        const facetIdentifier = FacetIdentifierSchema.parse({
            key: 'categories',
        });
        const facetValueIdentifier = FacetValueIdentifierSchema.parse({
            facet: facetIdentifier,
            key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
        });

        return success(facetValueIdentifier);
    }

    protected override parseFacetValue(
        facetValueIdentifier: FacetValueIdentifier,
        label: string,
        count: number
    ): ProductSearchResultFacetValue {
        throw new Error('Method not implemented.');
    }

    protected override parseFacet(
        facetIdentifier: FacetIdentifier,
        facetValue: unknown
    ): ProductSearchResultFacet {
        throw new Error('Method not implemented.');
    }
}
