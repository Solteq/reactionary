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
 * The index fields behind the facets and filters Reactionary knows from its own model (price, rating, availability, taxonomy). The defaults are the
 * names the indexer (recalcitrant) writes, see its TARGET_FORMATS.md, so they only need setting for an index that names them differently.
 */
export const SearchFacetFieldsSchema = z.looseObject({
  priceMin: z.string().optional().meta({ description: 'The lowest list price of a product in minor units. Default minPrice.' }),
  priceMax: z.string().optional().meta({ description: 'The highest list price of a product in minor units. Default maxPrice.' }),
  rating: z.string().optional().meta({ description: 'The average rating rounded down, 0 to 5. Default reviewBucket.' }),
  online: z.string().optional().meta({ description: 'True when the product is available online. Default availableOnline.' }),
  stores: z.string().optional().meta({ description: 'The ids of the stores that have the product in stock. Default availableStores.' }),
  conceptIds: z.string().optional().meta({ description: 'The ids of the concepts of the product with their ancestors, prefixed by vocabulary. Used to filter. Default conceptIds.' }),
  conceptFacetPrefix: z.string().optional().meta({ description: 'The prefix of the facets that count the concepts of a vocabulary, as "<concept id>|<name>" values. Default conceptFacets.' }),
});

export type SearchFacetFieldsOptions = InferType<typeof SearchFacetFieldsSchema>;

export interface SearchFacetFields {
  priceMin: string;
  priceMax: string;
  rating: string;
  online: string;
  stores: string;
  conceptIds: string;
  /** Includes the separating dot, e.g. "conceptFacets.". */
  conceptFacetPrefix: string;
}

export const DEFAULT_SEARCH_FACET_FIELDS: SearchFacetFields = {
  priceMin: 'minPrice',
  priceMax: 'maxPrice',
  rating: 'reviewBucket',
  online: 'availableOnline',
  stores: 'availableStores',
  conceptIds: 'conceptIds',
  conceptFacetPrefix: 'conceptFacets.',
};

/**
 * Which facets of a search engine are returned to the storefront, in which order, and how they are named. The engine returns a facet
 * for every faceted attribute, and not every one is for display.
 */
export const SearchFacetPolicyOptionsSchema = z.looseObject({
  hidden: z.array(z.string()).optional().meta({ description: 'Facet keys to hide on top of the default ones (flags and the fields behind price, rating, availability and taxonomy). A key hides itself and the facets nested under it: "internal" hides "internal" and "internal.x", but not "internal_x" or "internalOther".' }),
  names: z.record(z.string(), z.string()).optional().meta({ description: 'Display names by facet key, on top of the default ones. They win over the default names, a facet without a name keeps the one of the engine. The typed facets are named by "price", "rating" and "availability", and the facet of a vocabulary by "taxonomy:<vocabulary>" (or its index key "conceptFacets.<vocabulary>"); a vocabulary without a name is named after its id.' }),
  order: z.array(z.string()).optional().meta({ description: 'The facets to return, in the order to return them, as an allowlist: a facet that is not named is not returned. An entry is the key of an attribute facet, or one of "price", "rating", "availability", "taxonomy" (every vocabulary) and "taxonomy:<vocabulary>". An attribute whose key is one of those words is written "attribute:<key>". Without it every facet that is not hidden is returned, attributes first.' }),
  multiselect: z.array(z.string()).optional().meta({ description: 'The keys of the attribute facets that are multiselect: the values selected within one widen the search (any of them matches, across facets they still all must), and the facet keeps returning the values and counts it would have without its own selection, so that the shopper can add one more. Price, rating, availability and taxonomy are fixed by their kind. Never applies to the categories facet.' }),
  fields: SearchFacetFieldsSchema.optional(),
});

export type SearchFacetPolicyOptions = InferType<typeof SearchFacetPolicyOptionsSchema>;

export interface SearchFacetPolicy {
  hidden: string[];
  names: Record<string, string>;
  /** Undefined returns every facet that is not hidden. */
  order: string[] | undefined;
  multiselect: string[];
  fields: SearchFacetFields;
}

/**
 * The facet of the product type name.
 */
export const SEARCH_PRODUCT_TYPE_FACET_KEY = 'productType.name';

/**
 * The facets that only drive behaviour or are filter-only fields are never shown: flags, the fields of the review summary and
 * the old concept name facets (concepts.<vocabulary>), which taxonomy facets replace. The product type facet is named "Product type".
 * Concept facets are named after the vocabulary, see getConceptFacetName.
 */
const ALWAYS_HIDDEN_FACETS = ['flags', 'concepts', 'listprices', 'hasReviews', 'reviewScore', 'reviewCount', 'availableInStore'];

/** The facets the fields behind a typed facet are returned as by the engine, so that they are not returned a second time as attributes. */
function getFieldFacetKeys(fields: SearchFacetFields): string[] {
  return [fields.priceMin, fields.priceMax, fields.rating, fields.online, fields.stores, fields.conceptIds, fields.conceptFacetPrefix.replace(/\.$/, '')];
}

export const DEFAULT_SEARCH_FACET_POLICY: SearchFacetPolicy = {
  hidden: [...ALWAYS_HIDDEN_FACETS, ...getFieldFacetKeys(DEFAULT_SEARCH_FACET_FIELDS)],
  names: { [SEARCH_PRODUCT_TYPE_FACET_KEY]: 'Product type' },
  order: undefined,
  multiselect: [],
  fields: DEFAULT_SEARCH_FACET_FIELDS,
};

/**
 * Builds the policy from the options of a provider, merged with the defaults. Hidden facets only add to the
 * defaults, the flags and the fields behind a typed facet can not be shown again as attributes. Names of the options win over the default ones.
 */
export function createSearchFacetPolicy(options?: SearchFacetPolicyOptions): SearchFacetPolicy {
  const fields: SearchFacetFields = { ...DEFAULT_SEARCH_FACET_FIELDS };
  for (const [name, value] of Object.entries(options?.fields ?? {})) {
    if (typeof value === 'string' && name in fields) {
      fields[name as keyof SearchFacetFields] = value;
    }
  }
  return {
    hidden: [...new Set([...ALWAYS_HIDDEN_FACETS, ...getFieldFacetKeys(fields), ...(options?.hidden ?? [])])],
    names: { ...DEFAULT_SEARCH_FACET_POLICY.names, ...(options?.names ?? {}) },
    order: options?.order,
    multiselect: options?.multiselect ?? [],
    fields,
  };
}

/**
 * Whether a facet is never shown to the storefront: a hidden key or a key nested under it (`flags`, `flags.x`),
 * but not another facet that starts with the same letters (`flagship`). Engines return facet distributions for every faceted
 * attribute when asked for all of them, so providers drop the hidden ones from the result.
 */
export function isHiddenSearchFacet(facetKey: string, policy: SearchFacetPolicy = DEFAULT_SEARCH_FACET_POLICY): boolean {
  // the key itself or a nested key, not any facet that merely starts with the same letters
  return policy.hidden.some((hidden) => facetKey === hidden || facetKey.startsWith(`${hidden}.`));
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
