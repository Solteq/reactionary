import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { ProductSearchIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const ProductSearchQueryByTermSchema = BaseQuerySchema.extend({
    search: ProductSearchIdentifierSchema
});

export type ProductSearchQueryByTerm = InferType<typeof ProductSearchQueryByTermSchema>;
