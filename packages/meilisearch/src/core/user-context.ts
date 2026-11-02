import { DEFAULT_AFFINITY_BAND_WEIGHTS, type PersonalizationProfile } from '@reactionary/core';

/** The longest user context sent: Meilisearch's personalization reads it as free text. */
export const MAX_USER_CONTEXT_LENGTH = 500;

/** The most concepts named for each strength of interest. */
const MAX_CONCEPTS_PER_STRENGTH = 4;

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept, which `affinities` carry. */
const AFFINITY_SEGMENT = /^affinity\./;

/** `features/cordless` is "cordless", `application/power-tools` is "power tools". */
function conceptName(conceptId: string): string {
  const slug = conceptId.split('/').pop() ?? conceptId;
  return slug.replace(/[-_]+/g, ' ').trim();
}

function conceptNames(affinities: ReadonlyArray<readonly [string, number]>): string[] {
  const names = affinities
    .slice()
    .sort(([idA, a], [idB, b]) => b - a || idA.localeCompare(idB))
    .map(([id]) => conceptName(id))
    .filter((name) => name !== '');
  return [...new Set(names)].slice(0, MAX_CONCEPTS_PER_STRENGTH);
}

/**
 * The text Meilisearch's personalization ranks by (`personalize.userContext`), or undefined when there is nothing to say of the visitor.
 *
 * It is the blurb of the profile, the segments a merchandiser knows by name, and the strong and the some interests, said in words:
 * "Strong interest in: cordless, power tools. Some interest in: drilling fastening". The affinity segments themselves
 * (`affinity.features.cordless.high`) are left out, they are one per concept and band and say nothing to a language model that the
 * interests do not say better. Low interests are left out, they are weak signal. Past {@link MAX_USER_CONTEXT_LENGTH} characters the rest
 * is cut off, the blurb first to stay.
 */
export function userContextOf(profile: Pick<PersonalizationProfile, 'blurb' | 'segments' | 'affinities'> | undefined): string | undefined {
  if (!profile) {
    return undefined;
  }
  const parts: string[] = [];

  const blurb = (profile.blurb ?? '').trim();
  const segments = (profile.segments ?? []).filter((segment) => !AFFINITY_SEGMENT.test(segment));
  if (blurb) {
    parts.push(blurb);
  } else if (segments.length > 0) {
    parts.push('The customer is in the following segments: ' + segments.join(', '));
  }

  const { medium, high } = DEFAULT_AFFINITY_BAND_WEIGHTS;
  const interests = Object.entries(profile.affinities ?? {}).flatMap(([id, weight]): Array<[string, number]> => (typeof weight === 'number' ? [[id, weight]] : []));
  const strong = conceptNames(interests.filter(([, weight]) => weight >= high));
  const some = conceptNames(interests.filter(([, weight]) => weight >= medium && weight < high));
  if (strong.length > 0) {
    parts.push('Strong interest in: ' + strong.join(', '));
  }
  if (some.length > 0) {
    parts.push('Some interest in: ' + some.join(', '));
  }

  const text = parts.join('. ');
  return text === '' ? undefined : text.slice(0, MAX_USER_CONTEXT_LENGTH);
}
