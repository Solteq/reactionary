import * as z from 'zod';
import type { InferType } from '../zod-utils.js';

/**
 * Who personalizes a product search for a visitor with a profile:
 * - `engine`: the search engine, in whatever way the provider supports (the default, and what a provider did before this option).
 *   A provider whose engine cannot personalize does nothing.
 * - `affinity`: Reactionary, by reordering the page the engine returned by the interests of the visitor (see AffinityRanking).
 *   The provider then asks the engine for no personalization of its own, so the same interests are not counted twice.
 * - `none`: nobody.
 *
 * Only `affinity` has settings of its own, so only it has a `strength`.
 */
export const SearchPersonalizationOptionsSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('engine') }).meta({ description: 'The search engine personalizes, as far as the provider supports it. This is what a provider does without the option.' }),
  z.strictObject({ mode: z.literal('none') }).meta({ description: 'Nobody personalizes.' }),
  z
    .strictObject({
      mode: z.literal('affinity'),
      strength: z.number().min(0).max(1).optional().meta({ description: 'The most the interest of the visitor can add to the relevance of a hit, as a factor between 0 and 1. Default 0.4.' }),
    })
    .meta({ description: 'Reactionary reorders the page the engine returned by the interests of the visitor, within that page only, and the provider asks the engine for no personalization.' }),
]);

export type SearchPersonalizationOptions = InferType<typeof SearchPersonalizationOptionsSchema>;

export type SearchPersonalizationMode = SearchPersonalizationOptions['mode'];

/** The options of the affinity mode, the ones AffinityRanking is made from. */
export type AffinitySearchPersonalizationOptions = Extract<SearchPersonalizationOptions, { mode: 'affinity' }>;

export const DEFAULT_SEARCH_PERSONALIZATION_MODE: SearchPersonalizationMode = 'engine';

/** The mode of the options of a provider, `engine` when none are given. */
export function searchPersonalizationModeOf(options?: SearchPersonalizationOptions): SearchPersonalizationMode {
  return options?.mode ?? DEFAULT_SEARCH_PERSONALIZATION_MODE;
}

/** The default of `strength`. */
export const DEFAULT_AFFINITY_RANKING_STRENGTH = 0.4;

/** The base relevance of the last hit of a page, the first hit being 1. Compressed, so that interest can move a hit from the bottom too. */
export const AFFINITY_RANKING_LAST_HIT_RELEVANCE = 0.5;

/** What the ranking reads of a search hit. A ProductSearchResultItem is one. */
export interface AffinityRankableHit {
  identifier: { key: string };
  /** How well the engine matched the hit, 0 to 1, when it says. Without it the position on the page is the relevance. */
  relevance?: number;
  /** The concepts of the hit, with their ancestors. Hits without concepts have no interest to rank by. */
  concepts?: ReadonlyArray<{ identifier: { key: string } }>;
}

/** What the ranking reads of a profile. A PersonalizationProfile is one. */
export interface AffinityRankableProfile {
  /** Concept id to a weight in (0, 1]. */
  affinities?: Readonly<Record<string, number>>;
}

/**
 * Reorders a page of search hits by the interests of the visitor and keeps what the search engine decided. One algorithm for every
 * provider that lets Reactionary personalize (`mode: 'affinity'`), built from the options of the provider by
 * `ProductSearchCapability.createSearchRanking`.
 *
 * It reorders the page it is given and nothing more: a hit on another page is not pulled in. Each hit has a base relevance: how well the
 * engine matched it when the item says (`relevance`), otherwise its position on the page, falling in a straight line from 1 for the first
 * hit to 0.5 for the last. The interest of the hit, between 0 and 1, lifts it by up to `strength`: `base * (1 + strength * interest)`. It
 * is the blend of `rankByConcepts` (relevance * (1 + strength * affinity)), for a search that has no concepts of its own to measure
 * relevance by. Equal scores keep the order of the engine, so a visitor with no interest in anything gets the page as it came.
 *
 * The interest of a hit is the highest weight among its concepts. A hit carries its concepts with their ancestors, so the interest in a
 * concept reaches the products below it, and a hit in two related concepts is not counted twice.
 *
 * Every step is a protected method: subclass and override what a project needs, for example `baseRelevanceOf` to measure relevance some
 * other way or `affinityWeightsOf` to spread the interest to related concepts, and return the subclass from `createSearchRanking` of
 * the provider.
 */
export class AffinityRanking {
  protected readonly strength: number;

  constructor(options?: { strength?: number }) {
    const strength = options?.strength;
    this.strength = typeof strength === 'number' && Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : DEFAULT_AFFINITY_RANKING_STRENGTH;
  }

  /** The page in its new order. The hits and the list given are left as they are. */
  public rank<T extends AffinityRankableHit>(hits: readonly T[], profile: AffinityRankableProfile | undefined): T[] {
    const weights = this.affinityWeightsOf(profile);
    if (weights.size === 0 || hits.length < 2) {
      return [...hits];
    }
    return hits
      .map((hit, index) => ({
        hit,
        index,
        score: this.blend(this.baseRelevanceOf(hit, index, hits.length), this.interestOf(this.conceptIdsOf(hit), weights)),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.hit);
  }

  /** The weight of the interest of the visitor in each concept. Override to spread the interest to related concepts, say. */
  protected affinityWeightsOf(profile: AffinityRankableProfile | undefined): ReadonlyMap<string, number> {
    const weights = new Map<string, number>();
    for (const [conceptId, weight] of Object.entries(profile?.affinities ?? {})) {
      if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
        weights.set(conceptId, weight);
      }
    }
    return weights;
  }

  /** The ids of the concepts of a hit. */
  protected conceptIdsOf(hit: AffinityRankableHit): string[] {
    return (hit.concepts ?? []).map((concept) => concept.identifier.key);
  }

  /** The interest in a hit, 0 to 1: the highest weight among its concepts. */
  protected interestOf(conceptIds: readonly string[], weights: ReadonlyMap<string, number>): number {
    let interest = 0;
    for (const conceptId of conceptIds) {
      interest = Math.max(interest, weights.get(conceptId) ?? 0);
    }
    return Math.min(1, interest);
  }

  /**
   * How well the engine matched a hit, 0 to 1: the relevance of the item when the provider got one from the engine, otherwise from its
   * position on the page. Override to measure it some other way.
   */
  protected baseRelevanceOf(hit: AffinityRankableHit, index: number, count: number): number {
    if (typeof hit.relevance === 'number' && Number.isFinite(hit.relevance)) {
      return Math.min(1, Math.max(0, hit.relevance));
    }
    return 1 - (1 - AFFINITY_RANKING_LAST_HIT_RELEVANCE) * (index / Math.max(1, count - 1));
  }

  /** The score a hit is sorted by, from its base relevance and its interest. */
  protected blend(baseRelevance: number, interest: number): number {
    return baseRelevance * (1 + this.strength * interest);
  }
}
