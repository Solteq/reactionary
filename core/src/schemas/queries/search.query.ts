import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { SearchIdentifierSchema } from '../models/identifiers.model.js';

export const SearchQueryByTermSchema = BaseQuerySchema.extend({
    search: SearchIdentifierSchema.required()
});

export type SearchQueryByTerm = z.infer<typeof SearchQueryByTermSchema>;
