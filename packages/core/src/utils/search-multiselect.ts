import type { FacetIdentifier, FacetValueIdentifier } from '../schemas/models/identifiers.model.js';
import type { ProductSearchResultFacet } from '../schemas/models/product-search.model.js';

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
 * Splits the selected facet values by whether their facet is multiselect, see `multiselect` of the search identifier.
 * Without `multiselect` everything is `single`, which is how searches always worked.
 */
export function groupFacetSelections(
  selected: FacetValueIdentifier[],
  multiselect: FacetIdentifier[] | undefined,
): FacetSelectionGroups {
  const multiselectKeys = new Set((multiselect ?? []).map((facet) => facet.key));
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
 * (nothing matched the selection) is appended. A replacement without values is ignored.
 */
export function replaceFacets(
  facets: ProductSearchResultFacet[],
  replacements: ProductSearchResultFacet[],
): ProductSearchResultFacet[] {
  const merged = [...facets];
  for (const replacement of replacements) {
    if (replacement.values.length === 0) {
      continue;
    }
    const index = merged.findIndex((facet) => facet.identifier.key === replacement.identifier.key);
    if (index === -1) {
      merged.push(replacement);
    } else {
      merged[index] = replacement;
    }
  }
  return merged;
}
