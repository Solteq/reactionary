import { DEFAULT_AFFINITY_BAND_WEIGHTS, type PersonalizationProfile } from '@reactionary/core';
import { byCodePoint } from './rule-contexts.js';

/** The attribute of the index that holds the concept ids of a product, with those of the concepts above them. */
export const CONCEPT_IDS_ATTRIBUTE = 'conceptIds';

/** The most concepts that rank a search. */
export const MAX_AFFINITY_FILTERS = 5;

/** Algolia scores are whole numbers: the weight of the interest, which is up to 1, times this. */
const SCORE_PER_WEIGHT = 10;

/** A concept id is `<vocabulary>/<slug>`, which is safe in a filter. Anything else is left out rather than sent to be misread. */
const CONCEPT_ID = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)+$/;

/**
 * The `optionalFilters` that rank a search by the interests of the visitor: `conceptIds:features/cordless<score=10>`. A product with the
 * concept ranks higher, and one without it is not left out. Product concepts hold the concepts above them, so interest in
 * `application/power-tools` also lifts the products of its children.
 *
 * Only the strong and the some interests count (the high and the medium band), the low band is weak signal. The score is the weight times
 * ten: 10 for high, 6 for medium. At most {@link MAX_AFFINITY_FILTERS} concepts, the strongest first, and by concept id among equals, so
 * the same profile always gives the same filters.
 */
export function affinityOptionalFilters(profile: Pick<PersonalizationProfile, 'affinities'> | undefined): string[] {
  const { medium } = DEFAULT_AFFINITY_BAND_WEIGHTS;
  return Object.entries(profile?.affinities ?? {})
    .flatMap(([id, weight]): Array<[string, number]> =>
      typeof weight === 'number' && Number.isFinite(weight) && weight >= medium && CONCEPT_ID.test(id) ? [[id, Math.min(1, weight)]] : [],
    )
    .sort(([idA, a], [idB, b]) => b - a || byCodePoint(idA, idB))
    .slice(0, MAX_AFFINITY_FILTERS)
    .map(([id, weight]) => `${CONCEPT_IDS_ATTRIBUTE}:${id}<score=${Math.round(weight * SCORE_PER_WEIGHT)}>`);
}
