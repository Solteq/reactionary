import type {
  Concept,
  ConceptExpansionPolicy,
  ConceptPersonalization,
  ConceptRankedItem,
  ConceptRankingItem,
  ExpandedConcept,
  RelatedConcept,
  Vocabulary,
} from '../schemas/models/taxonomy.model.js';
import type { ProductConcept } from '../schemas/models/product.model.js';

/**
 * Pure functions to navigate and score taxonomy concepts. They know nothing about providers, so they are
 * easy to test and to reuse. The TaxonomyCapability wraps them and fetches the vocabularies they need.
 */

/**
 * The deepest level the navigation follows. The weights fade out long before that, this only guards
 * against runaway trees.
 */
const MAX_NAVIGATION_DEPTH = 16;

export interface ConceptIndex {
  /** The concept with the id, if it is in the loaded vocabularies. */
  get(id: string): Concept | undefined;
  /** The ancestors of the concept, nearest first. Cycle safe, empty for an unknown id. */
  ancestors(id: string): string[];
  /** The descendants of the concept with their depth, nearest first. Cycle safe, empty for an unknown id. */
  descendants(id: string, options?: { maxDepth?: number }): Array<{ id: string; depth: number }>;
  /** The concepts related to the concept, seen from both ends of a link. */
  related(id: string): string[];
  /** Whether the first concept is a (transitive) ancestor of the second. */
  isAncestorOf(ancestorId: string, descendantId: string): boolean;
}

function vocabularyOfId(id: string): string {
  const separator = id.indexOf('/');
  return separator > 0 ? id.slice(0, separator) : '';
}

/**
 * Indexes the concepts of the vocabularies. The hierarchy is taken from the parent of a concept and from the
 * tree of children, related links are made symmetric. Missing ids and loops in the data are tolerated.
 */
export function buildConceptIndex(vocabularies: Vocabulary[]): ConceptIndex {
  const concepts = new Map<string, Concept>();
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const relatedTo = new Map<string, string[]>();

  const addEdge = (map: Map<string, string[]>, from: string, to: string) => {
    const list = map.get(from) ?? [];
    if (!list.includes(to)) {
      list.push(to);
    }
    map.set(from, list);
  };

  const visit = (concept: Concept, treeParent: string | undefined, seen: Set<Concept>) => {
    // a circular tree would never end, an object seen on the way down is skipped
    if (seen.has(concept)) {
      return;
    }
    seen.add(concept);
    const id = concept.identifier.key;
    if (!concepts.has(id)) {
      concepts.set(id, concept);
    }
    const parent = concept.parent?.key ?? treeParent;
    if (parent && parent !== id && !parentOf.has(id)) {
      parentOf.set(id, parent);
    }
    for (const related of concept.related ?? []) {
      if (related.key !== id) {
        addEdge(relatedTo, id, related.key);
        addEdge(relatedTo, related.key, id);
      }
    }
    for (const child of concept.children ?? []) {
      visit(child, id, seen);
    }
    seen.delete(concept);
  };

  for (const vocabulary of vocabularies) {
    for (const concept of vocabulary.concepts) {
      visit(concept, undefined, new Set());
    }
  }

  for (const [id, parent] of parentOf) {
    addEdge(childrenOf, parent, id);
  }

  const ancestors = (id: string): string[] => {
    const result: string[] = [];
    const seen = new Set<string>([id]);
    let current = parentOf.get(id);
    while (current && !seen.has(current)) {
      result.push(current);
      seen.add(current);
      current = parentOf.get(current);
    }
    return result;
  };

  return {
    get: (id) => concepts.get(id),
    ancestors,
    descendants: (id, options) => {
      const maxDepth = options?.maxDepth ?? MAX_NAVIGATION_DEPTH;
      const result: Array<{ id: string; depth: number }> = [];
      const seen = new Set<string>([id]);
      let level = [id];
      for (let depth = 1; depth <= maxDepth && level.length > 0; depth++) {
        const next: string[] = [];
        for (const parent of level) {
          for (const child of childrenOf.get(parent) ?? []) {
            if (!seen.has(child)) {
              seen.add(child);
              next.push(child);
              result.push({ id: child, depth });
            }
          }
        }
        level = next;
      }
      return result;
    },
    related: (id) => [...(relatedTo.get(id) ?? [])],
    isAncestorOf: (ancestorId, descendantId) => ancestors(descendantId).includes(ancestorId),
  };
}

/**
 * Splits the concepts of a product into the ones assigned to it and the ones that are only there because they
 * are an ancestor of another one. Product.concepts holds the closure over the ancestors: the assigned concepts
 * and every ancestor of them. A concept that is the parent (transitively, through ProductConcept.parent) of
 * another concept in the list is therefore taken as broader, the rest are direct.
 *
 * The inference cannot tell a concept that was assigned explicitly and also is the ancestor of another assigned
 * concept (a product tagged with both power and cordless) from a pure ancestor, it counts it as broader. An
 * explicit set of direct ids, when the producer knows them, overrides the inference.
 */
export function splitDirectAndBroader(
  productConcepts: Array<Pick<ProductConcept, 'identifier' | 'parent'>>,
  directIds?: Iterable<string>,
): { direct: string[]; broader: string[] } {
  const ids = [...new Set(productConcepts.map((concept) => concept.identifier.key))];

  if (directIds) {
    const explicit = new Set(directIds);
    return {
      direct: ids.filter((id) => explicit.has(id)),
      broader: ids.filter((id) => !explicit.has(id)),
    };
  }

  const parentOf = new Map<string, string>();
  for (const concept of productConcepts) {
    if (concept.parent) {
      parentOf.set(concept.identifier.key, concept.parent.key);
    }
  }
  const broaderIds = new Set<string>();
  for (const id of ids) {
    const seen = new Set<string>([id]);
    let current = parentOf.get(id);
    while (current && !seen.has(current)) {
      // a parent that is no product concept is not part of the closure, it stays out
      broaderIds.add(current);
      seen.add(current);
      current = parentOf.get(current);
    }
  }
  return {
    direct: ids.filter((id) => !broaderIds.has(id)),
    broader: ids.filter((id) => broaderIds.has(id)),
  };
}

/**
 * A concept to expand. The weight defaults to 1, profile affinities use it to say how much the concept counts.
 */
export interface ConceptSeed {
  identifier: { key: string };
  vocabulary?: string;
  parent?: { key: string };
  weight?: number;
}

export interface ResolvedExpansionPolicy {
  narrowerWeight: number;
  narrowerDecay: number;
  relatedWeight: number;
  broaderWeight: number;
  broaderDecay: number;
  minWeight: number;
}

export const DEFAULT_EXPANSION_POLICY: ResolvedExpansionPolicy = {
  narrowerWeight: 0.8,
  narrowerDecay: 0.8,
  relatedWeight: 0.5,
  broaderWeight: 0.4,
  broaderDecay: 0.6,
  minWeight: 0.15,
};

/**
 * Expands the seeds to the concepts around them: the seed itself (exact, weight 1), its descendants (narrower,
 * decaying per level), its related concepts (one hop, never transitive) and its ancestors (broader, decaying per
 * hop). The weights are multiplied by the weight of the seed, and concepts below the minimum weight are dropped,
 * without walking the part of the tree below the cut. The vocabularies of the seeds are always reached, the
 * vocabularies of the policy come on top of them, e.g. to follow related links into another vocabulary.
 * Seeds for the same concept are merged and keep the highest weight. A concept reached in several ways keeps its
 * best weight. The result is sorted by weight, highest first.
 *
 * The seeds must be the concepts that were assigned, not the closure over their ancestors (see
 * splitDirectAndBroader), otherwise an ancestor is treated as an exact match and its other children as narrower.
 */
export function expandConcepts(
  index: ConceptIndex,
  seeds: ConceptSeed[],
  policy: ConceptExpansionPolicy = {},
): ExpandedConcept[] {
  const pick = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const resolved: ResolvedExpansionPolicy = {
    narrowerWeight: pick(policy.narrowerWeight, DEFAULT_EXPANSION_POLICY.narrowerWeight),
    narrowerDecay: pick(policy.narrowerDecay, DEFAULT_EXPANSION_POLICY.narrowerDecay),
    relatedWeight: pick(policy.relatedWeight, DEFAULT_EXPANSION_POLICY.relatedWeight),
    broaderWeight: pick(policy.broaderWeight, DEFAULT_EXPANSION_POLICY.broaderWeight),
    broaderDecay: pick(policy.broaderDecay, DEFAULT_EXPANSION_POLICY.broaderDecay),
    minWeight: pick(policy.minWeight, DEFAULT_EXPANSION_POLICY.minWeight),
  };
  const vocabularyOf = (id: string) => index.get(id)?.vocabulary ?? vocabularyOfId(id);
  // merge the seeds of one concept, the highest weight wins
  const merged = new Map<string, ConceptSeed>();
  for (const seed of seeds) {
    const known = merged.get(seed.identifier.key);
    if (!known || (seed.weight ?? 1) > (known.weight ?? 1)) {
      merged.set(seed.identifier.key, seed);
    }
  }
  const allowed = new Set([
    ...[...merged.values()].map((seed) => seed.vocabulary || vocabularyOfId(seed.identifier.key)),
    ...(policy.vocabularies ?? []),
  ]);

  const best = new Map<string, ExpandedConcept>();
  const offer = (id: string, weight: number, via: ExpandedConcept['via'], source: string) => {
    if (!Number.isFinite(weight) || weight < resolved.minWeight || !allowed.has(vocabularyOf(id))) {
      return;
    }
    const current = best.get(id);
    // the best weight wins, an exact concept wins a tie against one that was merely reached
    if (current && (current.weight > weight || (current.weight === weight && (via !== 'exact' || current.via === 'exact')))) {
      return;
    }
    best.set(id, {
      identifier: { key: id },
      weight,
      via,
      ...(via === 'exact' ? {} : { source: { key: source } }),
    });
  };

  // a weight that shrinks with the level lets the walk stop at the first level below the minimum
  const stopsWhenBelowMinimum = (decay: number) => decay <= 1;
  const narrowerWeightAt = (seedWeight: number, depth: number) =>
    seedWeight * resolved.narrowerWeight * resolved.narrowerDecay ** (depth - 1);

  for (const seed of merged.values()) {
    const id = seed.identifier.key;
    const seedWeight = seed.weight ?? 1;
    if (!Number.isFinite(seedWeight) || seedWeight <= 0) {
      continue;
    }

    offer(id, seedWeight, 'exact', id);

    let maxDepth = MAX_NAVIGATION_DEPTH;
    if (stopsWhenBelowMinimum(resolved.narrowerDecay)) {
      maxDepth = 0;
      while (maxDepth < MAX_NAVIGATION_DEPTH && narrowerWeightAt(seedWeight, maxDepth + 1) >= resolved.minWeight) {
        maxDepth += 1;
      }
    }
    if (maxDepth > 0) {
      for (const { id: descendant, depth } of index.descendants(id, { maxDepth })) {
        offer(descendant, narrowerWeightAt(seedWeight, depth), 'narrower', id);
      }
    }

    for (const related of index.related(id)) {
      offer(related, seedWeight * resolved.relatedWeight, 'related', id);
    }

    // the seed carries its own parent, which covers a taxonomy that is not (fully) loaded
    const chain = index.get(id) || !seed.parent ? index.ancestors(id) : [seed.parent.key, ...index.ancestors(seed.parent.key)];
    for (let hop = 0; hop < chain.length; hop++) {
      const weight = seedWeight * resolved.broaderWeight * resolved.broaderDecay ** hop;
      if (weight < resolved.minWeight && stopsWhenBelowMinimum(resolved.broaderDecay)) {
        break;
      }
      offer(chain[hop], weight, 'broader', id);
    }
  }

  // the sort is stable, so equal weights keep the order they were found in
  return [...best.values()].sort((a, b) => b.weight - a.weight);
}

/**
 * The concepts reached from the starting concepts by the hierarchy or related links, for navigation.
 */
export function findRelatedConcepts(
  index: ConceptIndex,
  startIds: string[],
  options: { relations?: Array<RelatedConcept['relation']>; maxDepth?: number } = {},
): RelatedConcept[] {
  const relations = new Set(options.relations ?? ['broader', 'narrower', 'related']);
  const maxDepth = Math.max(1, options.maxDepth ?? 1);
  const result: RelatedConcept[] = [];

  for (const start of startIds) {
    const via = { key: start };
    if (relations.has('broader')) {
      index.ancestors(start).slice(0, maxDepth).forEach((id, hop) => {
        result.push({ concept: { key: id }, relation: 'broader', depth: hop + 1, via });
      });
    }
    if (relations.has('narrower')) {
      for (const { id, depth } of index.descendants(start, { maxDepth })) {
        result.push({ concept: { key: id }, relation: 'narrower', depth, via });
      }
    }
    if (relations.has('related')) {
      for (const id of index.related(start)) {
        result.push({ concept: { key: id }, relation: 'related', depth: 1, via });
      }
    }
  }
  return result;
}

/**
 * The score of one item: its best matching concept dominates, the others add a quarter of their weight.
 */
export function scoreConceptIds(conceptIds: string[], expansion: ExpandedConcept[]): number {
  return scoreWithWeights(conceptIds, conceptWeights(expansion));
}

/**
 * The weight per concept id of an expansion, built once to score many items against it.
 */
export function conceptWeights(expansion: ExpandedConcept[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const concept of expansion) {
    const known = weights.get(concept.identifier.key);
    if (known === undefined || concept.weight > known) {
      weights.set(concept.identifier.key, concept.weight);
    }
  }
  return weights;
}

/**
 * Like scoreConceptIds with the weights of conceptWeights.
 */
export function scoreWithWeights(conceptIds: string[], weights: Map<string, number>): number {
  const matches = [...new Set(conceptIds)]
    .map((id) => weights.get(id))
    .filter((weight): weight is number => weight !== undefined)
    .sort((a, b) => b - a);
  if (matches.length === 0) {
    return 0;
  }
  const [max, ...rest] = matches;
  return max + 0.25 * rest.reduce((sum, weight) => sum + weight, 0);
}

/**
 * Scores the items against an expansion and sorts them, best first. Items with equal scores keep their order.
 */
export function scoreItems(
  items: ConceptRankingItem[],
  expansion: ExpandedConcept[],
): Array<{ key: string; score: number }> {
  const weights = conceptWeights(expansion);
  return items
    .map((item) => ({ key: item.key, score: scoreWithWeights(item.concepts, weights) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Turns affinities (concept id to interest score) into seeds. Scores that are not finite or not above zero are
 * ignored and the top N are kept. If the highest score is above 1 the scores are scaled down by it, so arbitrary
 * large numbers cannot swamp the relevance of the content. Scores that are already within (0, 1], like the
 * banded ones of affinitiesFromSegments, are kept as they are, which makes the normalization idempotent.
 */
export function affinitiesToSeeds(affinities: Record<string, number>, options: { topN?: number } = {}): ConceptSeed[] {
  const topN = options.topN ?? 20;
  const entries = Object.entries(affinities).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
  );
  const top = entries.sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, topN));
  if (top.length === 0) {
    return [];
  }
  const max = Math.max(1, top[0][1]);
  return top.map(([id, score]) => ({
    identifier: { key: id },
    vocabulary: vocabularyOfId(id),
    weight: score / max,
  }));
}

/**
 * Ranks items by how well their concepts match a context (e.g. the concepts of the product on the page), and
 * optionally by the interests of a profile.
 *
 * - relevance is the score against the context, affinity the score against the profile.
 * - mode context ranks on relevance only.
 * - mode blend (the default) ranks on relevance * (1 + strength * affinity). The profile can therefore only
 *   reorder relevant items, and by at most the strength (default 0.5, clamped to 0..1, the affinity counts at
 *   most 1 here). An item without relevance stays at 0.
 * - mode profile ranks on affinity only. Blend does the same when there is no context, e.g. a "for you" feed.
 * - without a profile (no affinity), the context and blend modes rank exactly like the context alone. The profile
 *   mode then has nothing to rank on and scores every item 0.
 * - Scores below 0 are treated as 0, so a malformed weight cannot push an item down. The strength may be any
 *   number, it is clamped to 0..1 (not a number: the default).
 *
 * The result is sorted by score, highest first. Equal scores are ordered by relevance, then by input order.
 */
export function rankItems(
  items: ConceptRankingItem[],
  options: {
    context?: ExpandedConcept[];
    affinity?: ExpandedConcept[];
    personalization?: ConceptPersonalization;
  } = {},
): ConceptRankedItem[] {
  const context = options.context ?? [];
  const affinity = options.affinity ?? [];
  const requested = options.personalization?.mode ?? 'blend';
  const mode = requested === 'blend' && context.length === 0 ? 'profile' : requested;
  const rawStrength = options.personalization?.strength;
  const strength =
    typeof rawStrength === 'number' && !Number.isNaN(rawStrength) ? Math.min(1, Math.max(0, rawStrength)) : 0.5;
  // the weights of an expansion are built once, not once per item
  const contextWeights = conceptWeights(context);
  const affinityWeights = conceptWeights(affinity);

  return items
    .map((item) => {
      const relevance = Math.max(0, scoreWithWeights(item.concepts, contextWeights));
      const affinityScore = Math.max(0, scoreWithWeights(item.concepts, affinityWeights));
      let score: number;
      if (mode === 'profile') {
        score = affinityScore;
      } else if (mode === 'context') {
        score = relevance;
      } else {
        score = relevance * (1 + strength * Math.min(1, affinityScore));
      }
      return { key: item.key, score, relevance, affinity: affinityScore };
    })
    // the profile comes in a few coarse bands, so ties are common: relevance decides first, then the input order
    .sort((a, b) => b.score - a.score || b.relevance - a.relevance);
}

/**
 * The weight of a band in affinitiesFromSegments.
 */
export interface AffinityBandWeights {
  low: number;
  medium: number;
  high: number;
}

export const DEFAULT_AFFINITY_BAND_WEIGHTS: AffinityBandWeights = { low: 0.3, medium: 0.6, high: 1 };

/**
 * Reads the interest of a visitor in concepts from the segments of the personalization profile.
 *
 * A segment named affinity.<vocabulary>.<slug>.<band>, band being low, medium or high, means that the visitor has
 * that interest in the concept <vocabulary>/<slug>, e.g. affinity.features.cordless.high is features/cordless.
 * Vocabulary ids and slugs never contain a dot, so the segment is split on the dots and must have exactly four
 * parts. Everything else is some other segment and ignored. Several bands for one concept keep the highest.
 * The weights are in (0, 1], the thresholds of the bands are a concern of the CDP, the raw scores never leave it.
 */
export function affinitiesFromSegments(
  segments: string[],
  options: { bandWeights?: Partial<AffinityBandWeights> } = {},
): Record<string, number> {
  const weights: AffinityBandWeights = { ...DEFAULT_AFFINITY_BAND_WEIGHTS };
  for (const band of ['low', 'medium', 'high'] as const) {
    const custom = options.bandWeights?.[band];
    if (typeof custom === 'number' && Number.isFinite(custom) && custom > 0) {
      weights[band] = Math.min(1, custom);
    }
  }

  const affinities: Record<string, number> = {};
  for (const segment of segments) {
    if (typeof segment !== 'string') {
      continue;
    }
    const parts = segment.split('.');
    if (parts.length !== 4 || parts[0] !== 'affinity' || parts[1] === '' || parts[2] === '') {
      continue;
    }
    const band = parts[3];
    if (band !== 'low' && band !== 'medium' && band !== 'high') {
      continue;
    }
    const id = `${parts[1]}/${parts[2]}`;
    affinities[id] = Math.max(affinities[id] ?? 0, weights[band]);
  }
  return affinities;
}
