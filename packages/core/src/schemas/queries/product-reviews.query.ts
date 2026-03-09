import * as z from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { PaginationOptionsSchema, ProductIdentifierSchema } from '../models/index.js';
import type { InferType } from '../../zod-utils.js';

export const ProductReviewsListQuerySchema = BaseQuerySchema.extend({
  product: ProductIdentifierSchema.meta({ description: 'The product to list reviews for.' }),
  paginationOptions: PaginationOptionsSchema.optional().meta({ description: 'Optional pagination options for the review list.' }),
});

export const ProductReviewsGetRatingSummaryQuerySchema = BaseQuerySchema.extend({
  product: ProductIdentifierSchema.meta({ description: 'The product to get rating summary for.' }),
});

export type ProductReviewsListQuery = InferType<typeof ProductReviewsListQuerySchema>;
export type ProductReviewsGetRatingSummaryQuery = InferType<typeof ProductReviewsGetRatingSummaryQuerySchema>;
