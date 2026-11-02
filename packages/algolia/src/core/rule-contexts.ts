import type { PersonalizationProfile } from '@reactionary/core';

/** Algolia takes at most this many rule contexts in one query. */
export const MAX_RULE_CONTEXTS = 10;

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept. */
const AFFINITY_SEGMENT = /^affinity\./;
const HIGH_AFFINITY_SEGMENT = /^affinity\.[^.]+\.[^.]+\.high$/;

/** A rule context may only hold letters, digits, hyphens and underscores. */
const NOT_ALLOWED = /[^A-Za-z0-9_-]/g;

/**
 * The Algolia rule contexts of a visitor, one `segment_<name>` per segment, with every character Algolia does not accept in a context
 * (the dots of an affinity segment, say) replaced by `_`: `affinity.features.cordless.high` becomes `segment_affinity_features_cordless_high`.
 *
 * The segments a merchandiser knows by name come first. Of the affinity segments only the `high` band is sent: there is one segment per
 * concept and band, and Algolia takes {@link MAX_RULE_CONTEXTS} contexts, so only the strong interests are worth a rule. The lower bands
 * are for ranking, through the `affinities` of the profile. Past `max` the rest is left out, curated segments last to go.
 */
export function segmentRuleContexts(
  profile: Pick<PersonalizationProfile, 'segments'> | undefined,
  max: number = MAX_RULE_CONTEXTS,
): string[] {
  const segments = profile?.segments ?? [];
  const named = segments.filter((segment) => !AFFINITY_SEGMENT.test(segment));
  const interests = segments.filter((segment) => HIGH_AFFINITY_SEGMENT.test(segment));
  const contexts = [...named, ...interests].map((segment) => `segment_${segment.replace(NOT_ALLOWED, '_')}`);
  return [...new Set(contexts)].slice(0, Math.max(0, max));
}
