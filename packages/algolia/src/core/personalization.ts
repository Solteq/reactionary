import { DEFAULT_AFFINITY_BAND_WEIGHTS, type PersonalizationProfile } from '@reactionary/core';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';

/** The segments the CDP names `affinity.<vocabulary>.<slug>.<band>`: interest in a concept, which ranks products instead of being a context. */
const AFFINITY_SEGMENT = /^affinity\./;

/** Algolia only takes letters, digits, hyphens and underscores in a rule context. */
const NOT_ALLOWED_IN_CONTEXT = /[^A-Za-z0-9_-]/g;

/** A concept id is `<vocabulary>/<slug>`, which is safe in a filter. Anything else is left out rather than sent to be misread. */
const CONCEPT_ID = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)+$/;

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

/**
 * How the segments and the interests of a visitor become what a query tells Algolia, by the search and the recommendations alike:
 * - the segments are the rule contexts a merchandiser writes rules against (`segment_<name>`);
 * - the interests rank products, through `optionalFilters` on the concepts of the product.
 *
 * How observations and audiences turn into search behaviour is specific to the search engine, so this is Algolia's own. Every step is a
 * method that a subclass can override. The search and the recommendations capabilities are separate classes with no common base, so each
 * uses a subclass through its own `personalization()`: override it in both to change both.
 */
export class AlgoliaPersonalization {
  /** Algolia takes at most this many rule contexts in one query. */
  protected readonly maxRuleContexts: number = 10;

  /** The most concepts that rank a query. */
  protected readonly maxAffinityFilters: number = 5;

  /** The attribute of the index that holds the concept ids of a product, with those of the concepts above them. */
  protected readonly conceptIdsAttribute: string = 'conceptIds';

  /** Algolia scores are whole numbers: the weight of an interest, which is up to 1, times this. */
  protected readonly scorePerWeight: number = 10;

  constructor(protected readonly config: Pick<AlgoliaConfiguration, 'ruleContextSegments'>) {}

  /**
   * The segments that may become rule contexts: every segment but the affinity segments and, when `ruleContextSegments` is set, only
   * those that match one of its patterns (`*` is the wildcard). An empty list lets none through.
   */
  protected ruleContextSegmentsOf(profile: Pick<PersonalizationProfile, 'segments'>): string[] {
    const allowed = this.config.ruleContextSegments;
    return (profile.segments ?? []).filter(
      (segment) => !AFFINITY_SEGMENT.test(segment) && (allowed === undefined || matchesSegmentPattern(allowed, segment)),
    );
  }

  /** The rule context of a segment: `segment_<name>`, with every character Algolia does not accept replaced by `_`. */
  protected ruleContextOf(segment: string): string {
    return `segment_${segment.replace(NOT_ALLOWED_IN_CONTEXT, '_')}`;
  }

  /**
   * The rule contexts of a visitor, in alphabetical order by segment name and cut after `maxRuleContexts` less `reserved`, the room that
   * contexts sent next to these take (the labels of a recommendation). What is sent follows from the segments alone, never from the order
   * the CDP lists them in. A context is there once.
   */
  public ruleContexts(profile: Pick<PersonalizationProfile, 'segments'> | undefined, reserved = 0): string[] {
    if (!profile) {
      return [];
    }
    const contexts = [...this.ruleContextSegmentsOf(profile)].sort(byCodePoint).map((segment) => this.ruleContextOf(segment));
    return [...new Set(contexts)].slice(0, Math.max(0, this.maxRuleContexts - reserved));
  }

  /**
   * The interests that rank a query, as concept id and weight: the strong and the some interests (the high and the medium band, the low band
   * is weak signal), the strongest first and by concept id among equals, at most `maxAffinityFilters`. Weights are capped at 1, and what is
   * not a number or not a concept id is left out.
   */
  protected rankingAffinitiesOf(profile: Pick<PersonalizationProfile, 'affinities'>): Array<[string, number]> {
    const { medium } = DEFAULT_AFFINITY_BAND_WEIGHTS;
    return Object.entries(profile.affinities ?? {})
      .flatMap(([id, weight]): Array<[string, number]> =>
        typeof weight === 'number' && Number.isFinite(weight) && weight >= medium && CONCEPT_ID.test(id) ? [[id, Math.min(1, weight)]] : [],
      )
      .sort(([idA, a], [idB, b]) => b - a || byCodePoint(idA, idB))
      .slice(0, this.maxAffinityFilters);
  }

  /** The optional filter of one interest: `conceptIds:features/cordless<score=10>`. A product with the concept ranks higher. */
  protected optionalFilterOf(conceptId: string, weight: number): string {
    return `${this.conceptIdsAttribute}:${conceptId}<score=${Math.round(weight * this.scorePerWeight)}>`;
  }

  /**
   * The `optionalFilters` that rank a query by the interests of the visitor. A product without the concept is not left out. Product
   * concepts hold the concepts above them, so interest in `application/power-tools` also lifts the products of its children. The same
   * profile always gives the same filters.
   */
  public optionalFilters(profile: Pick<PersonalizationProfile, 'affinities'> | undefined): string[] {
    if (!profile) {
      return [];
    }
    return this.rankingAffinitiesOf(profile).map(([id, weight]) => this.optionalFilterOf(id, weight));
  }
}
