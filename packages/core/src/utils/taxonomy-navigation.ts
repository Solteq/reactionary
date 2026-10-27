import type {
  Concept,
  ConceptExpansionPolicy,
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
 * are an ancestor of another one. Product.concepts holds the closure over the ancestors, so a concept that is
 * the parent (transitively, through ProductConcept.parent) of another product concept is broader, the rest are
 * direct. An explicit set of direct ids, when the producer knows them, overrides the inference.
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
 * hop). The weights are multiplied by the weight of the seed, concepts below the minimum weight are dropped, and
 * only the vocabularies of the seeds are reached unless the policy names others. A concept reached in several
 * ways keeps its best weight. The result is sorted by weight, highest first.
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
  const allowed = new Set(
    policy.vocabularies ?? seeds.map((seed) => seed.vocabulary || vocabularyOfId(seed.identifier.key)),
  );

  const best = new Map<string, ExpandedConcept>();
  const offer = (id: string, weight: number, via: ExpandedConcept['via'], source: string) => {
    if (!Number.isFinite(weight) || weight < resolved.minWeight || !allowed.has(vocabularyOf(id))) {
      return;
    }
    const current = best.get(id);
    if (current && current.weight >= weight) {
      return;
    }
    best.set(id, {
      identifier: { key: id },
      weight,
      via,
      ...(via === 'exact' ? {} : { source: { key: source } }),
    });
  };

  for (const seed of seeds) {
    const id = seed.identifier.key;
    const seedWeight = seed.weight ?? 1;
    if (!Number.isFinite(seedWeight) || seedWeight <= 0) {
      continue;
    }

    offer(id, seedWeight, 'exact', id);

    for (const { id: descendant, depth } of index.descendants(id)) {
      offer(descendant, seedWeight * resolved.narrowerWeight * resolved.narrowerDecay ** (depth - 1), 'narrower', id);
    }

    for (const related of index.related(id)) {
      offer(related, seedWeight * resolved.relatedWeight, 'related', id);
    }

    // the seed carries its own parent, which covers a taxonomy that is not (fully) loaded
    const chain = index.get(id) || !seed.parent ? index.ancestors(id) : [seed.parent.key, ...index.ancestors(seed.parent.key)];
    chain.forEach((ancestor, hop) => {
      offer(ancestor, seedWeight * resolved.broaderWeight * resolved.broaderDecay ** hop, 'broader', id);
    });
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
  const weights = new Map(expansion.map((concept) => [concept.identifier.key, concept.weight]));
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
  return items
    .map((item) => ({ key: item.key, score: scoreConceptIds(item.concepts, expansion) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Turns profile affinities (concept id to raw interest score) into seeds. Scores that are not finite or not
 * above zero are ignored, the top N are kept and normalized to (0, 1] by the highest score, so a profile with
 * very large scores cannot swamp the relevance of the content.
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
  const max = top[0][1];
  return top.map(([id, score]) => ({
    identifier: { key: id },
    vocabulary: vocabularyOfId(id),
    weight: score / max,
  }));
}
