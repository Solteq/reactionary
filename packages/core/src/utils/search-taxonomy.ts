import * as z from 'zod';
import type { ProductTerm, ProductType } from '../schemas/models/product.model.js';
import type { InferType } from '../zod-utils.js';

/**
 * The taxonomy fields of a product search document, as written by the indexer.
 * Flags are filter-only and not returned on hits.
 */
export const SearchDocumentTaxonomySchema = z.looseObject({
  productType: z.looseObject({
    id: z.string(),
    name: z.string().default(''),
  }).optional().meta({ description: 'The product type of the product.' }),
  terms: z.record(z.string(), z.array(z.string())).optional().meta({ description: 'The localized term names of the product, by vocabulary.' }),
  termIds: z.array(z.string()).optional().meta({ description: 'The ids of the terms of the product, prefixed by their vocabulary, e.g. "features/cordless".' }),
});

export type SearchDocumentTaxonomy = InferType<typeof SearchDocumentTaxonomySchema>;

/**
 * The facet key prefix under which the term names of a vocabulary are indexed, e.g. terms.features.
 */
export const SEARCH_TERM_FACET_PREFIX = 'terms.';

/**
 * Names a vocabulary after its id, e.g. power-source becomes "Power Source".
 */
export function getVocabularyName(vocabulary: string): string {
  return vocabulary
    .split(/[-_\s]+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Names the facet of a vocabulary after the vocabulary id, e.g. terms.power-source becomes "Power Source".
 * Returns undefined for facets that are not term facets.
 */
export function getTermFacetName(facetKey: string): string | undefined {
  if (!facetKey.startsWith(SEARCH_TERM_FACET_PREFIX) || facetKey.length === SEARCH_TERM_FACET_PREFIX.length) {
    return undefined;
  }
  return getVocabularyName(facetKey.slice(SEARCH_TERM_FACET_PREFIX.length));
}

/**
 * Facet keys that are never shown to the storefront: flags only drive behaviour, and termIds is a
 * filter-only list of ids. Engines return facet distributions for every faceted attribute when asked
 * for all of them, so providers drop these from the result.
 */
export function isHiddenSearchFacet(facetKey: string): boolean {
  return facetKey.startsWith('flags') || facetKey.startsWith('termIds');
}

/**
 * The facet of the product type name.
 */
export const SEARCH_PRODUCT_TYPE_FACET_KEY = 'productType.name';

/**
 * Display name of a taxonomy facet: the vocabulary for term facets, "Product type" for the product type
 * facet. Returns undefined for other facets.
 */
export function getTaxonomyFacetName(facetKey: string): string | undefined {
  if (facetKey === SEARCH_PRODUCT_TYPE_FACET_KEY) {
    return 'Product type';
  }
  return getTermFacetName(facetKey);
}

/**
 * Maps the taxonomy fields of a search hit to the product type and terms of a search result item.
 * The localized names are listed per vocabulary and are matched to the term ids in order within the
 * vocabulary. A term without a matching name gets the last part of its id as name. Terms are only
 * produced from termIds, as a name alone cannot identify a term.
 */
export function parseSearchDocumentTaxonomy(hit: unknown): { productType?: ProductType; terms?: ProductTerm[] } {
  const parsed = SearchDocumentTaxonomySchema.safeParse(hit);
  if (!parsed.success) {
    return {};
  }
  const { productType, terms, termIds } = parsed.data;
  const result: { productType?: ProductType; terms?: ProductTerm[] } = {};

  if (productType) {
    result.productType = { identifier: { key: productType.id }, name: productType.name };
  }

  if (termIds) {
    const seenPerVocabulary = new Map<string, number>();
    result.terms = [];
    for (const id of termIds) {
      const separator = id.indexOf('/');
      const vocabulary = separator > 0 ? id.slice(0, separator) : '';
      const slug = separator >= 0 ? id.slice(separator + 1) : id;
      const index = seenPerVocabulary.get(vocabulary) ?? 0;
      seenPerVocabulary.set(vocabulary, index + 1);
      const names = terms?.[vocabulary] ?? [];
      // positional matching is only safe when every term of the vocabulary has a name
      const aligned = names.length === termIds.filter((x) => x.startsWith(`${vocabulary}/`)).length;
      result.terms.push({
        identifier: { key: id },
        vocabulary,
        name: (aligned ? names[index] : undefined) || slug,
      });
    }
  }

  return result;
}
