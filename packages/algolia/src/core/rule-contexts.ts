import type { PersonalizationProfile } from '@reactionary/core';

/** Algolia takes at most this many rule contexts in one query. */
export const MAX_RULE_CONTEXTS = 10;

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept, which ranks products (see `affinity-filters.ts`). */
const AFFINITY_SEGMENT = /^affinity\./;

/** A rule context may only hold letters, digits, hyphens and underscores. */
const NOT_ALLOWED = /[^A-Za-z0-9_-]/g;

/** Alphabetical by code point, so the order never depends on the locale of the server. */
export function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A pattern as a regular expression: `*` stands for any run of characters (also none), everything else must be there as it is. */
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** Whether a segment name is one of the patterns. `*` is the wildcard. */
export function matchesSegmentPattern(patterns: readonly string[], segment: string): boolean {
  return patterns.some((pattern) => patternToRegExp(pattern).test(segment));
}

export interface SegmentRuleContextOptions {
  /** The most contexts to send. Defaults to what Algolia takes. A recommendation passes what its labels leave. */
  max?: number;
  /** When set, only the segments that match one of these patterns (`*` is the wildcard) are sent. An empty list sends none. */
  allowed?: readonly string[];
}

/**
 * The Algolia rule contexts of a visitor, one `segment_<name>` per segment:
 * - Every segment but the affinity segments, which rank products instead.
 * - Of those only the ones that match `allowed`, when it is set.
 * - In alphabetical order, and cut after `max`: what is sent depends on the segments alone, never on the order the CDP lists them in.
 * - Every character Algolia does not accept in a context is replaced by `_` (`big spender` becomes `segment_big_spender`).
 */
export function segmentRuleContexts(
  profile: Pick<PersonalizationProfile, 'segments'> | undefined,
  options: SegmentRuleContextOptions = {},
): string[] {
  const { max = MAX_RULE_CONTEXTS, allowed } = options;
  const segments = (profile?.segments ?? []).filter(
    (segment) => !AFFINITY_SEGMENT.test(segment) && (allowed === undefined || matchesSegmentPattern(allowed, segment)),
  );
  const contexts = segments.sort(byCodePoint).map((segment) => `segment_${segment.replace(NOT_ALLOWED, '_')}`);
  // A context once: segments that differ only in what is replaced, and a segment listed twice, are the same context
  return [...new Set(contexts)].slice(0, Math.max(0, max));
}
