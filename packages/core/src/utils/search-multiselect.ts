import type { FacetValueIdentifier } from '../schemas/models/identifiers.model.js';
import type { ProductSearchResultFacet } from '../schemas/models/product-search.model.js';
import { getSearchFacetId, hasSearchFacetContent } from './search-facets.js';

/** The categories facet is navigation: one value at a time, never multiselect. */
const CATEGORY_FACET_KEY = 'categories';

/** The selected facet values, split by how they combine. */
export interface FacetSelectionGroups {
  /** Values of facets that are not multiselect: every one of them must match. */
  single: FacetValueIdentifier[];
  /** Values of multiselect facets by facet key, in the order selected: any one of a key's values matches. */
  multi: Map<string, FacetValueIdentifier[]>;
}

/**
 * Splits the selected attribute facet values by whether their facet is multiselect, see `multiselect` of the facet policy.
 * With no multiselect facets everything is `single`, which is how searches always worked.
 */
export function groupFacetSelections(
  selected: FacetValueIdentifier[],
  multiselect: readonly string[] | undefined,
): FacetSelectionGroups {
  const multiselectKeys = new Set(multiselect ?? []);
  multiselectKeys.delete(CATEGORY_FACET_KEY);

  const groups: FacetSelectionGroups = { single: [], multi: new Map() };
  for (const value of selected) {
    const key = value.facet.key;
    if (!multiselectKeys.has(key)) {
      groups.single.push(value);
      continue;
    }
    const values = groups.multi.get(key) ?? [];
    values.push(value);
    groups.multi.set(key, values);
  }
  return groups;
}

/**
 * Replaces the facets of a search result by the same facets as the search returns them without their own selection,
 * so that a multiselect facet keeps offering its siblings. A facet stays where it was, and a facet the result lacks
 * (nothing matched the selection) is appended. A replacement without anything to offer is ignored.
 */
export function replaceFacets(
  facets: ProductSearchResultFacet[],
  replacements: ProductSearchResultFacet[],
): ProductSearchResultFacet[] {
  const merged = [...facets];
  for (const replacement of replacements) {
    if (!hasSearchFacetContent(replacement)) {
      continue;
    }
    const id = getSearchFacetId(replacement);
    const index = merged.findIndex((facet) => getSearchFacetId(facet) === id);
    if (index === -1) {
      merged.push(replacement);
    } else {
      merged[index] = replacement;
    }
  }
  return merged;
}

/**
 * Puts the stats of the facets of another search on the facets of a search result, and nothing else: the values and counts of a facet stay
 * those of the search itself. A facet the result lacks (nothing matched) is added without values, so that a slider keeps its bounds.
 * Only attribute and price facets have stats.
 */
export function withFacetStats(
  facets: ProductSearchResultFacet[],
  withStats: ProductSearchResultFacet[],
): ProductSearchResultFacet[] {
  const merged = [...facets];
  for (const source of withStats) {
    if ((source.semantic !== 'attribute' && source.semantic !== 'price') || !source.stats) {
      continue;
    }
    const id = getSearchFacetId(source);
    const index = merged.findIndex((facet) => getSearchFacetId(facet) === id);
    const existing = merged[index];
    if (existing === undefined) {
      merged.push(source.semantic === 'attribute' ? { ...source, values: [] } : source);
    } else if (existing.semantic === 'attribute' || existing.semantic === 'price') {
      merged[index] = { ...existing, stats: source.stats };
    }
  }
  return merged;
}
