import type { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { SearchIdentifierSchema } from '../models/identifiers.model';

export const SearchQueryByTermSchema = BaseQuerySchema.extend({
    search: SearchIdentifierSchema.required()
});

export type SearchQueryByTerm = z.infer<typeof SearchQueryByTermSchema>;
