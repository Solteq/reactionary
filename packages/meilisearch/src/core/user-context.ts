import { DEFAULT_AFFINITY_BAND_WEIGHTS, type PersonalizationProfile } from '@reactionary/core';

/** The longest user context sent: Meilisearch's personalization reads it as free text. */
export const MAX_USER_CONTEXT_LENGTH = 500;

/** The most concepts named as a strong interest. */
export const MAX_STRONG_INTERESTS = 5;

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept, which `affinities` carry. */
const AFFINITY_SEGMENT = /^affinity\./;

/** Alphabetical by code point, so the order never depends on the locale of the server. */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `features/cordless` is "cordless", `application/power-tools` is "power tools". */
function conceptName(conceptId: string): string {
  const slug = conceptId.split('/').pop() ?? conceptId;
  return slug.replace(/[-_]+/g, ' ').trim();
}

/**
 * The text Meilisearch's personalization ranks by (`personalize.userContext`), or undefined when there is nothing to say of the visitor.
 *
 * In this order:
 * 1. The blurb of the profile, when it has one.
 * 2. The strong interests, said in words: "Strong interest in: cordless, power tools". These are the concepts of the high band, at most
 *    {@link MAX_STRONG_INTERESTS}, by concept id. The lower bands are left out as weak signal.
 * 3. All the other segments, alphabetically: "The customer is in the following segments: lapsed, vip". The affinity segments are not
 *    among them, the interests above say them better.
 *
 * Past {@link MAX_USER_CONTEXT_LENGTH} characters the rest is cut off, so it is the segments that go first.
 */
export function userContextOf(profile: Pick<PersonalizationProfile, 'blurb' | 'segments' | 'affinities'> | undefined): string | undefined {
  if (!profile) {
    return undefined;
  }
  const parts: string[] = [];

  const blurb = (profile.blurb ?? '').trim();
  if (blurb) {
    parts.push(blurb);
  }

  const { high } = DEFAULT_AFFINITY_BAND_WEIGHTS;
  const strong = [
    ...new Set(
      Object.entries(profile.affinities ?? {})
        .flatMap(([id, weight]): string[] => (typeof weight === 'number' && weight >= high ? [id] : []))
        .sort(byCodePoint)
        .map(conceptName)
        .filter((name) => name !== ''),
    ),
  ].slice(0, MAX_STRONG_INTERESTS);
  if (strong.length > 0) {
    parts.push('Strong interest in: ' + strong.join(', '));
  }

  const segments = [...new Set((profile.segments ?? []).filter((segment) => !AFFINITY_SEGMENT.test(segment)))].sort(byCodePoint);
  if (segments.length > 0) {
    parts.push('The customer is in the following segments: ' + segments.join(', '));
  }

  const text = parts.join('. ');
  return text === '' ? undefined : text.slice(0, MAX_USER_CONTEXT_LENGTH);
}
