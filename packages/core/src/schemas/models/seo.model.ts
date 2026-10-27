import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';

/**
 * Authored SEO metadata for a page backed by an entity (product, category).
 *
 * Providers set only values that were explicitly authored in the source system, in the locale of the request.
 * An empty field means "not authored", never "empty on purpose". Use `resolveSeo` to apply fallbacks at read time.
 *
 * Whether this is populated can depend on how the entity was fetched, as some backends only return it on lookups by slug.
 */
export const SeoSchema = z.looseObject({
  title: z.string().optional().meta({ description: 'The authored page title (meta title), in the language of the request.' }),
  description: z.string().optional().meta({ description: 'The authored meta description, in the language of the request.' }),
  robots: z.string().optional().meta({ description: 'The authored robots directive, written verbatim, e.g. "noindex, follow" or "max-image-preview:large".' }),
});

export type Seo = InferType<typeof SeoSchema>;
