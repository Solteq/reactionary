import type { PersonalizationProfile } from '@reactionary/core';

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept, which `affinities` carry. */
const AFFINITY_SEGMENT = /^affinity\./;

/**
 * The Algolia rule contexts of a visitor, one `segment_<name>` per segment. The affinity segments are left out: they are one per concept
 * and band, so there can be a great many of them, and a rule is written against a segment a merchandiser knows by name, not against
 * interest in a concept. Interest is for ranking through the `affinities` of the profile.
 */
export function segmentRuleContexts(profile: Pick<PersonalizationProfile, 'segments'> | undefined): string[] {
  return (profile?.segments ?? []).filter((segment) => !AFFINITY_SEGMENT.test(segment)).map((segment) => `segment_${segment}`);
}
