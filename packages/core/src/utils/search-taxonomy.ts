import * as z from 'zod';
import type { ProductConcept, ProductType } from '../schemas/models/product.model.js';
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
  concepts: z.record(z.string(), z.array(z.string())).optional().meta({ description: 'The localized concept names of the product, by vocabulary.' }),
  conceptIds: z.array(z.string()).optional().meta({ description: 'The ids of the concepts of the product, prefixed by their vocabulary, e.g. "features/cordless".' }),
});

export type SearchDocumentTaxonomy = InferType<typeof SearchDocumentTaxonomySchema>;

/**
 * The facet key prefix under which the concept names of a vocabulary are indexed, e.g. concepts.features.
 */
export const SEARCH_CONCEPT_FACET_PREFIX = 'concepts.';

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
 * Names the facet of a vocabulary after the vocabulary id, e.g. concepts.power-source becomes "Power Source".
 * Returns undefined for facets that are not concept facets.
 */
export function getConceptFacetName(facetKey: string): string | undefined {
  if (!facetKey.startsWith(SEARCH_CONCEPT_FACET_PREFIX) || facetKey.length === SEARCH_CONCEPT_FACET_PREFIX.length) {
    return undefined;
  }
  return getVocabularyName(facetKey.slice(SEARCH_CONCEPT_FACET_PREFIX.length));
}

/**
 * Which facets of a search engine are hidden from the storefront and how they are named. The engine returns a facet
 * for every faceted attribute, and not every one is for display.
 */
export const SearchFacetPolicyOptionsSchema = z.looseObject({
  hidden: z.array(z.string()).optional().meta({ description: 'Facet keys to hide on top of the default ones (flags and conceptIds). A facet whose key starts with one of them is hidden.' }),
  names: z.record(z.string(), z.string()).optional().meta({ description: 'Display names by facet key, on top of the default ones. They win over the default names, a facet without a name keeps the one of the engine.' }),
});

export type SearchFacetPolicyOptions = InferType<typeof SearchFacetPolicyOptionsSchema>;

export interface SearchFacetPolicy {
  hidden: string[];
  names: Record<string, string>;
}

/**
 * The facet of the product type name.
 */
export const SEARCH_PRODUCT_TYPE_FACET_KEY = 'productType.name';

/**
 * The defaults: flags only drive behaviour and conceptIds is a filter-only list of ids, so neither is ever shown,
 * and the product type facet is named "Product type". Concept facets (concepts.<vocabulary>) are named after the
 * vocabulary, see getConceptFacetName.
 */
export const DEFAULT_SEARCH_FACET_POLICY: SearchFacetPolicy = {
  hidden: ['flags', 'conceptIds'],
  names: { [SEARCH_PRODUCT_TYPE_FACET_KEY]: 'Product type' },
};

/**
 * Builds the policy from the options of a provider, merged with the defaults. Hidden facets only add to the
 * defaults, the flags and the concept ids can not be shown again. Names of the options win over the default ones.
 */
export function createSearchFacetPolicy(options?: SearchFacetPolicyOptions): SearchFacetPolicy {
  return {
    hidden: [...new Set([...DEFAULT_SEARCH_FACET_POLICY.hidden, ...(options?.hidden ?? [])])],
    names: { ...DEFAULT_SEARCH_FACET_POLICY.names, ...(options?.names ?? {}) },
  };
}

/**
 * Whether a facet is never shown to the storefront. Engines return facet distributions for every faceted
 * attribute when asked for all of them, so providers drop the hidden ones from the result.
 */
export function isHiddenSearchFacet(facetKey: string, policy: SearchFacetPolicy = DEFAULT_SEARCH_FACET_POLICY): boolean {
  return policy.hidden.some((hidden) => facetKey.startsWith(hidden));
}

/**
 * Display name of a facet from the policy: a configured name, the vocabulary for concept facets, "Product type"
 * for the product type facet. Returns undefined for other facets, which keep the name the engine gives them.
 */
export function getTaxonomyFacetName(facetKey: string, policy: SearchFacetPolicy = DEFAULT_SEARCH_FACET_POLICY): string | undefined {
  return policy.names[facetKey] ?? getConceptFacetName(facetKey);
}

/**
 * Maps the taxonomy fields of a search hit to the product type and concepts of a search result item.
 *
 * The contract with the indexer (recalcitrant) is that conceptIds are sorted ascending and include the ancestors
 * of the assigned concepts, and that concepts[<vocabulary>] holds one localized name per concept of that vocabulary, in
 * ascending concept id order. The names are therefore matched to the concept ids by position within the vocabulary.
 * If the counts of a vocabulary differ, the pairing cannot be trusted and its concepts get the last part of their
 * id as name. Concepts are only produced from conceptIds, as a name alone cannot identify a concept.
 */
export function parseSearchDocumentTaxonomy(hit: unknown): { productType?: ProductType; concepts?: ProductConcept[] } {
  const parsed = SearchDocumentTaxonomySchema.safeParse(hit);
  if (!parsed.success) {
    return {};
  }
  const { productType, concepts, conceptIds } = parsed.data;
  const result: { productType?: ProductType; concepts?: ProductConcept[] } = {};

  if (productType) {
    result.productType = { identifier: { key: productType.id }, name: productType.name };
  }

  if (conceptIds) {
    const seenPerVocabulary = new Map<string, number>();
    result.concepts = [];
    for (const id of conceptIds) {
      const separator = id.indexOf('/');
      const vocabulary = separator > 0 ? id.slice(0, separator) : '';
      const slug = separator >= 0 ? id.slice(separator + 1) : id;
      const index = seenPerVocabulary.get(vocabulary) ?? 0;
      seenPerVocabulary.set(vocabulary, index + 1);
      const names = concepts?.[vocabulary] ?? [];
      // positional matching is only safe when every concept of the vocabulary has a name
      const aligned = names.length === conceptIds.filter((x) => x.startsWith(`${vocabulary}/`)).length;
      result.concepts.push({
        identifier: { key: id },
        vocabulary,
        name: (aligned ? names[index] : undefined) || slug,
      });
    }
  }

  return result;
}
