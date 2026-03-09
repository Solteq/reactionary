import * as z from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { ProductIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const ProductReviewMutationSubmitSchema = BaseMutationSchema.extend({
  product: ProductIdentifierSchema.meta({ description: 'The product to review.' }),
  rating: z.number().min(1).max(5).meta({ description: 'The rating value from 1 to 5.' }),
  title: z.string().meta({ description: 'The title or headline of the review.' }),
  content: z.string().meta({ description: 'The main content/body of the review.' }),
  authorName: z.string().meta({ description: 'The name of the review author.' }),
});

export type ProductReviewMutationSubmit = InferType<typeof ProductReviewMutationSubmitSchema>;
