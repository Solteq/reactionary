import { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { SearchIdentifierSchema } from '../models/common/identifiers.model';

export const SearchQueryByTermSchema = BaseQuerySchema.extend({
    query: z.literal('term'),
    search: SearchIdentifierSchema.required()
});
export const SearchQuerySchema = z.union([SearchQueryByTermSchema]);

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchQueryByTerm = z.infer<typeof SearchQueryByTermSchema>;
