import * as z from 'zod';
import { BaseModelSchema, createPaginatedResponseSchema } from './base.model.js';
import { ProductIdentifierSchema, ProductRatingIdentifierSchema, ProductReviewIdentifierSchema } from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

/**
 * All our reviews are normalized to 1-5 star ratings
 */
export const ProductRatingSummarySchema = BaseModelSchema.extend({
  identifier: ProductRatingIdentifierSchema,
  averageRating: z.number().min(0).max(5).meta({ description: 'The average rating for the product.' }),
  totalRatings: z.number().min(0).optional().meta({ description: 'The total number of ratings for the product.' }),
  ratingDistribution: z.looseObject({
    '1': z.number().min(0).meta({ description: 'Number of 1-star ratings.' }),
    '2': z.number().min(0).meta({ description: 'Number of 2-star ratings.' }),
    '3': z.number().min(0).meta({ description: 'Number of 3-star ratings.' }),
    '4': z.number().min(0).meta({ description: 'Number of 4-star ratings.' }),
    '5': z.number().min(0).meta({ description: 'Number of 5-star ratings.' }),
  }).optional().meta({ description: 'Distribution of ratings across different star levels.' }),
});


export const ProductReviewSchema = BaseModelSchema.extend({
  identifier: ProductReviewIdentifierSchema,
  product: ProductIdentifierSchema.meta({ description: 'The product this review is for.' }),
  authorName: z.string().meta({ description: 'The name of the review author.' }),
  authorId: z.string().optional().meta({ description: 'Optional unique identifier for the review author.' }),
  rating: z.number().min(0).max(5).meta({ description: 'The rating given by the reviewer (0-5).' }),
  title: z.string().meta({ description: 'The title or headline of the review.' }),
  content: z.string().meta({ description: 'The main content/body of the review.' }),

  reply: z.string().optional().meta({ description: 'Optional reply from the store to this review.' }),
  repliedAt: z.string().optional().meta({ description: 'ISO8601 timestamp when the reply was made.' }),
  createdAt: z.string().meta({ description: 'ISO8601 timestamp when the review was created.' }),
  updatedAt: z.string().optional().meta({ description: 'ISO8601 timestamp when the review was last updated.' }),
  verified: z.boolean().meta({ description: 'Whether this is a verified purchase review.' }),
});

export const ProductReviewPaginatedResultSchema  = createPaginatedResponseSchema(ProductReviewSchema);
export type ProductReviewPaginatedResult = InferType<typeof ProductReviewPaginatedResultSchema>;


export type ProductReview = InferType<typeof ProductReviewSchema>;
export type ProductRatingSummary = InferType<typeof ProductRatingSummarySchema>;
