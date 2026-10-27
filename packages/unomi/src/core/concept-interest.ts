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

/**
 * The configured vocabularies, trimmed and lowercased like the ids they are compared with.
 */
function vocabularyFilter(vocabularies: string[] | undefined): Set<string> | undefined {
  return vocabularies ? new Set(vocabularies.map((vocabulary) => vocabulary.trim().toLowerCase())) : undefined;
}

interface Candidate extends InterestConcept {
  /** The number of lists (the lines of an order) the concept is a direct concept of. */
  frequency: number;
  order: number;
}

/**
 * Puts the candidates of one tier (equal depth and frequency) in the order they first appeared in, but takes them
 * round robin across the vocabularies, so that a cap that bites does not favour one vocabulary.
 */
function interleaveByVocabulary(tier: Candidate[]): Candidate[] {
  const byVocabulary = new Map<string, Candidate[]>();
  for (const candidate of tier) {
    const group = byVocabulary.get(candidate.vocabulary) ?? [];
    group.push(candidate);
    byVocabulary.set(candidate.vocabulary, group);
  }
  const groups = [...byVocabulary.values()];
  const result: Candidate[] = [];
  for (let round = 0; result.length < tier.length; round++) {
    for (const group of groups) {
      if (round < group.length) {
        result.push(group[round]);
      }
    }
  }
  return result;
}

/**
 * Picks the concepts to record as interest from the concepts of products. Each list is the Product.concepts of a
 * product, an order passes one list per line.
 *
 * Product.concepts holds the closure over the ancestors, only the direct concepts are interest, the broader ones
 * are expanded when the interest is read. The concepts are ordered by how specific they are (the deepest parent
 * chain first), then by how many lists they are a direct concept of (an order: the concept of more lines first).
 * Within equal depth and frequency the vocabularies take turns in the order of first appearance, so a cap does
 * not favour one vocabulary. The result is deterministic and capped.
 *
 * Ids go through normalizeConceptId like the ids of content, so the same concept is always sent under the same
 * id and counts once. Concepts whose id is not valid are dropped. The vocabularies are compared lowercased.
 */
export function selectInterestConcepts(
  conceptLists: Array<ProductConcept[] | undefined>,
  options: { vocabularies?: string[]; max: number },
): InterestConcept[] {
  const candidates = new Map<string, Candidate>();
  const allowedVocabularies = vocabularyFilter(options.vocabularies);

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
      const normalized = normalizeConceptId(id);
      if (!normalized || !byId.has(id)) {
        continue;
      }
      const vocabulary = normalized.slice(0, normalized.indexOf('/'));
      if (allowedVocabularies && !allowedVocabularies.has(vocabulary)) {
        continue;
      }
      const depth = depthOf(id);
      const known = candidates.get(normalized);
      if (known) {
        known.frequency += 1;
        known.depth = Math.max(known.depth, depth);
      } else {
        candidates.set(normalized, { id: normalized, vocabulary, depth, frequency: 1, order: candidates.size });
      }
    }
  }

  const tiers = new Map<string, Candidate[]>();
  const sorted = [...candidates.values()].sort((a, b) => b.depth - a.depth || b.frequency - a.frequency || a.order - b.order);
  for (const candidate of sorted) {
    const key = `${candidate.depth}:${candidate.frequency}`;
    const tier = tiers.get(key) ?? [];
    tier.push(candidate);
    tiers.set(key, tier);
  }

  return [...tiers.values()]
    .flatMap(interleaveByVocabulary)
    .slice(0, Math.max(0, options.max))
    .map(({ id, vocabulary, depth }) => ({ id, vocabulary, depth }));
}

/**
 * The longest concept id taken from content.
 */
export const MAX_CONCEPT_ID_LENGTH = 128;

const CONCEPT_ID_PATTERN = /^[a-z0-9_-]+\/[a-z0-9_-]+$/;

/**
 * A concept id as the sender accepts it: trimmed, lowercase, vocabulary/slug with letters, digits, _ and -.
 * Anything else (no slash, a dot in the slug, an empty or over-long id) is not a concept id and gives undefined.
 */
export function normalizeConceptId(raw: string): string | undefined {
  const id = raw.trim().toLowerCase();
  return id.length <= MAX_CONCEPT_ID_LENGTH && CONCEPT_ID_PATTERN.test(id) ? id : undefined;
}

/**
 * The interest concepts of content. The caller names the concepts of the content, most important first, and
 * knows which are direct, so the order of the caller is kept and the cap is applied in that order. Ids that are not
 * valid are dropped and duplicates only count once.
 */
export function contentInterestConcepts(
  ids: string[],
  options: { vocabularies?: string[]; max: number },
): InterestConcept[] {
  const seen = new Set<string>();
  const result: InterestConcept[] = [];
  const allowedVocabularies = vocabularyFilter(options.vocabularies);
  for (const raw of ids) {
    const id = typeof raw === 'string' ? normalizeConceptId(raw) : undefined;
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const vocabulary = id.slice(0, id.indexOf('/'));
    if (allowedVocabularies && !allowedVocabularies.has(vocabulary)) {
      continue;
    }
    result.push({ id, vocabulary, depth: 0 });
  }
  return result.slice(0, Math.max(0, options.max));
}

/**
 * The item id of a concept in an event: the concept id, with its slash encoded as __ when asked for.
 */
export function conceptItemId(id: string, encodeSlash: boolean): string {
  return encodeSlash ? id.replace('/', '__') : id;
}

/**
 * Runs the function over the items with at most `limit` running at the same time, results in input order.
 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const position = next++;
      results[position] = await fn(items[position]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}

/**
 * Lets a warning through at most once per key and interval, so that a backend that is down cannot log on every event.
 */
export class WarningThrottle {
  protected readonly lastWarned = new Map<string, number>();

  constructor(
    protected readonly intervalMs: number,
    protected readonly clock: () => number = () => Date.now(),
  ) {}

  /** True when the key may warn now, which also starts its interval. */
  public allow(key: string): boolean {
    const now = this.clock();
    const last = this.lastWarned.get(key);
    if (last !== undefined && now - last < this.intervalMs) {
      return false;
    }
    this.lastWarned.set(key, now);
    return true;
  }

  public reset(): void {
    this.lastWarned.clear();
  }
}

/**
 * The throttle of the concept interest warnings: one per event type per minute, for the whole process.
 */
export const conceptInterestWarnings = new WarningThrottle(60_000);
