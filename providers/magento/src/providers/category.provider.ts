import type { Category, Cache, CategoryPaginatedResult } from '@reactionary/core';
import {
    CategoryIdentifierSchema,
    CategoryProvider,
    CategorySchema,
    CategoryQueryByIdSchema,
    CategoryQueryBySlugSchema,
    CategoryQueryForBreadcrumbSchema,
    CategoryQueryForChildCategoriesSchema,
    CategoryQueryForTopCategoriesSchema,
    Reactionary,
    success,
    error,
    type Result,
    type NotFoundError,
    type CategoryQueryById,
    type CategoryQueryBySlug,
    type CategoryQueryForBreadcrumb,
    type CategoryQueryForChildCategories,
    type CategoryQueryForTopCategories,
    type RequestContext,
    CategoryPaginatedResultSchema,
} from '@reactionary/core';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import * as z from 'zod';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:category');

export class MagentoCategoryProvider extends CategoryProvider {
    protected config: MagentoConfiguration;

    constructor(
        config: MagentoConfiguration,
        cache: Cache,
        context: RequestContext,
        public magentoApi: MagentoClient
    ) {
        super(cache, context);
        this.config = config;
    }

    @Reactionary({
        inputSchema: CategoryQueryByIdSchema,
        outputSchema: CategorySchema,
    })
    public override async getById(payload: CategoryQueryById): Promise<Result<Category, NotFoundError>> {
        const client = await this.magentoApi.getClient();
        try {
            const response = await client.store.category.getById(payload.id.key);
            return success(this.parseSingle(response));
        } catch (e: any) {
            debug('Error getting category by id', e);
            return error<NotFoundError>({
                type: 'NotFound',
                identifier: payload
            });
        }
    }

    @Reactionary({
        inputSchema: CategoryQueryBySlugSchema,
        outputSchema: CategorySchema.nullable(),
    })
    public override async getBySlug(payload: CategoryQueryBySlug): Promise<Result<Category, NotFoundError>> {
        const client = await this.magentoApi.getClient();
        const params = new URLSearchParams();
        params.set('searchCriteria[filterGroups][0][filters][0][field]', 'url_key');
        params.set('searchCriteria[filterGroups][0][filters][0][value]', payload.slug);
        params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');
        params.set('searchCriteria[pageSize]', '1');

        try {
            const response = await client.store.category.list(params);
            if (!response.items || response.items.length === 0) {
                return error<NotFoundError>({
                    type: 'NotFound',
                    identifier: payload
                });
            }
            return success(this.parseSingle(response.items[0]));
        } catch (e: any) {
            debug('Error getting category by slug', e);
            return error<NotFoundError>({
                type: 'NotFound',
                identifier: payload
            });
        }
    }

    @Reactionary({
        inputSchema: CategoryQueryForBreadcrumbSchema,
        outputSchema: z.array(CategorySchema),
    })
    public override async getBreadcrumbPathToCategory(payload: CategoryQueryForBreadcrumb): Promise<Result<Category[]>> {
        const client = await this.magentoApi.getClient();
        try {
            const category = await client.store.category.getById(payload.id.key);
            // path is something like "1/2/3" where 1 is root, 2 is default, 3 is current category
            const pathIds = (category.path || '').split('/').filter(Boolean);

            if (pathIds.length === 0) {
                return success([this.parseSingle(category)]);
            }

            // Fetch all categories in path
            const params = new URLSearchParams();
            params.set('searchCriteria[filterGroups][0][filters][0][field]', 'entity_id');
            params.set('searchCriteria[filterGroups][0][filters][0][value]', pathIds.join(','));
            params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'in');

            const response = await client.store.category.list(params);
            const items = response.items || [];

            // Sort them by path order
            const results: Category[] = [];
            for (const id of pathIds) {
                const found = items.find((c: any) => String(c.id) === String(id));
                if (found) {
                    results.push(this.parseSingle(found));
                }
            }

            return success(results);
        } catch (e: any) {
            debug('Error getting breadcrumb path', e);
            throw new Error('Category not found or error fetching path: ' + payload.id.key);
        }
    }

    @Reactionary({
        inputSchema: CategoryQueryForChildCategoriesSchema,
        outputSchema: CategoryPaginatedResultSchema,
    })
    public override async findChildCategories(payload: CategoryQueryForChildCategories): Promise<Result<CategoryPaginatedResult>> {
        const client = await this.magentoApi.getClient();
        const pageSize = payload.paginationOptions.pageSize;
        const currentPage = payload.paginationOptions.pageNumber;

        const params = new URLSearchParams();
        params.set('searchCriteria[filterGroups][0][filters][0][field]', 'parent_id');
        params.set('searchCriteria[filterGroups][0][filters][0][value]', payload.parentId.key);
        params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');
        params.set('searchCriteria[pageSize]', String(pageSize));
        params.set('searchCriteria[currentPage]', String(currentPage));

        const response = await client.store.category.list(params);
        return success(this.parsePaginatedResult(response, pageSize, currentPage));
    }

    @Reactionary({
        inputSchema: CategoryQueryForTopCategoriesSchema,
        outputSchema: CategoryPaginatedResultSchema,
    })
    public override async findTopCategories(payload: CategoryQueryForTopCategories): Promise<Result<CategoryPaginatedResult>> {
        const client = await this.magentoApi.getClient();
        const pageSize = payload.paginationOptions.pageSize;
        const currentPage = payload.paginationOptions.pageNumber;

        const params = new URLSearchParams();
        params.set('searchCriteria[filterGroups][0][filters][0][field]', 'level');
        params.set('searchCriteria[filterGroups][0][filters][0][value]', '2');
        params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');

        params.set('searchCriteria[filterGroups][1][filters][0][field]', 'is_active');
        params.set('searchCriteria[filterGroups][1][filters][0][value]', '1');
        params.set('searchCriteria[filterGroups][1][filters][0][condition_type]', 'eq');

        params.set('searchCriteria[pageSize]', String(pageSize));
        params.set('searchCriteria[currentPage]', String(currentPage));

        const response = await client.store.category.list(params);
        return success(this.parsePaginatedResult(response, pageSize, currentPage));
    }

    protected parseSingle(body: any): Category {
        const identifier = CategoryIdentifierSchema.parse({
            key: String(body.id),
        });

        const name = String(body.name || '');
        const urlKeyAttr = (body.custom_attributes || []).find((a: any) => a.attribute_code === 'url_key');
        const slug = urlKeyAttr ? String(urlKeyAttr.value) : '';

        const textAttr = (body.custom_attributes || []).find((a: any) => a.attribute_code === 'description');
        const text = textAttr ? String(textAttr.value) : name;

        const parentCategoryStr = String(body.parent_id || '');
        const parentCategory = parentCategoryStr && parentCategoryStr !== '0'
            ? { key: parentCategoryStr }
            : undefined;

        return {
            identifier,
            name,
            slug,
            text,
            parentCategory,
            images: [],
        } satisfies Category;
    }

    protected parsePaginatedResult(
        remote: { items: any[]; total_count: number },
        pageSize: number,
        currentPage: number
    ): CategoryPaginatedResult {
        const items = (remote.items || []).map((c) => this.parseSingle(c));

        const totalCount = remote.total_count ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        return {
            pageNumber: currentPage,
            pageSize,
            totalCount,
            totalPages,
            items,
        } satisfies CategoryPaginatedResult;
    }
}
