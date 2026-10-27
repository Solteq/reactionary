import { splitDirectAndBroader, type ProductConcept } from '@reactionary/core';

/**
 * A concept of a product that is worth recording as interest, with how specific it is.
 */
export interface InterestConcept {
  id: string;
  vocabulary: string;
  /** The length of the parent chain within the concepts of the product, deeper is more specific. */
  depth: number;
}

function vocabularyOf(concept: Pick<ProductConcept, 'identifier' | 'vocabulary'>): string {
  if (concept.vocabulary) {
    return concept.vocabulary;
  }
  const separator = concept.identifier.key.indexOf('/');
  return separator > 0 ? concept.identifier.key.slice(0, separator) : '';
}

/**
 * Picks the concepts to record as interest from the concepts of products.
 *
 * Product.concepts holds the closure over the ancestors, only the direct concepts are interest, the broader ones
 * are expanded when the interest is read. The concepts of several products (an order) are de-duplicated. The
 * result is ordered most specific first (the deepest parent chain), then by id, so it is deterministic, and capped.
 */
export function selectInterestConcepts(
  conceptLists: Array<ProductConcept[] | undefined>,
  options: { vocabularies?: string[]; max: number },
): InterestConcept[] {
  const best = new Map<string, InterestConcept>();

  for (const concepts of conceptLists) {
    if (!Array.isArray(concepts) || concepts.length === 0) {
      continue;
    }
    const { direct } = splitDirectAndBroader(concepts);
    const byId = new Map(concepts.map((concept) => [concept.identifier.key, concept]));
    const depthOf = (id: string): number => {
      let depth = 0;
      const seen = new Set<string>([id]);
      let parent = byId.get(id)?.parent?.key;
      while (parent && !seen.has(parent)) {
        depth += 1;
        seen.add(parent);
        parent = byId.get(parent)?.parent?.key;
      }
      return depth;
    };

    for (const id of direct) {
      const concept = byId.get(id);
      if (!concept) {
        continue;
      }
      const vocabulary = vocabularyOf(concept);
      if (options.vocabularies && !options.vocabularies.includes(vocabulary)) {
        continue;
      }
      const depth = depthOf(id);
      const known = best.get(id);
      if (!known || known.depth < depth) {
        best.set(id, { id, vocabulary, depth });
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, Math.max(0, options.max));
}

/**
 * The item id of a concept in an event: the concept id, with its slash encoded as __ when asked for.
 */
export function conceptItemId(id: string, encodeSlash: boolean): string {
  return encodeSlash ? id.replace('/', '__') : id;
}
