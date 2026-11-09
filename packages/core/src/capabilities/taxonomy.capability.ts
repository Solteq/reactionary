import * as z from 'zod';
import { Reactionary } from '../decorators/reactionary.decorator.js';
import type { NotFoundError } from '../schemas/errors/not-found.error.js';
import {
  ConceptRankedItemSchema,
  ExpandedConceptSchema,
  RelatedConceptSchema,
  type Concept,
  type ConceptExpansionPolicy,
  type ConceptRankedItem,
  type ExpandedConcept,
  type RelatedConcept,
  type Vocabulary,
} from '../schemas/models/taxonomy.model.js';
import {
  TaxonomyQueryExpandAffinitiesSchema,
  TaxonomyQueryExpandConceptsSchema,
  TaxonomyQueryGetRelatedConceptsSchema,
  TaxonomyQueryRankByConceptsSchema,
  type TaxonomyQueryExpandAffinities,
  type TaxonomyQueryExpandConcepts,
  type TaxonomyQueryGetConcepts,
  type TaxonomyQueryGetRelatedConcepts,
  type TaxonomyQueryGetVocabulary,
  type TaxonomyQueryRankByConcepts,
} from '../schemas/queries/taxonomy.query.js';
import type { InvalidInputError } from '../schemas/errors/invalid-input.error.js';
import { error, success, type Result } from '../schemas/result.js';
import {
  affinitiesToSeeds,
  buildConceptIndex,
  DEFAULT_EXPANSION_POLICY,
  expandConcepts,
  findRelatedConcepts,
  limitExpansion,
  rankItems,
  splitDirectAndBroader,
  type ConceptIndex,
  type ConceptSeed,
} from '../utils/taxonomy-navigation.js';
import { BaseCapability } from './base.capability.js';

/**
 * How many getVocabulary calls run at the same time, and how many distinct vocabularies one call loads.
 * The helpers are exposed as tools, so what a single call can fan out to is bounded.
 */
const VOCABULARY_CONCURRENCY = 4;
const MAX_VOCABULARIES_PER_CALL = 40;

function vocabularyOfConceptId(id: string): string {
  const separator = id.indexOf('/');
  return separator > 0 ? id.slice(0, separator) : '';
}

/**
 * TaxonomyCapability
 *
 * Gives access to the taxonomy that products are classified with: vocabularies of concepts, e.g. "features"
 * with features/cordless. Products carry their concepts on Product.concepts, search results on the item concepts
 * and in the concept facets. This capability resolves the concepts behind those references.
 *
 * On top of the two abstract lookups it offers concrete helpers to navigate the concepts and to rank content by
 * them, for example to find the CMS articles that fit the product on a PDP. The helpers fetch through
 * getVocabulary, so the caching of the provider applies, and run the pure functions of taxonomy-navigation.
 * Subclasses can override any of them, but note that an override that does not repeat @Reactionary (or use
 * applyReactionary) loses the input and output validation, tracing and caching of the original.
 *
 * Nothing in these helpers is cached by them: the expensive part, loading the vocabularies, is cached by the
 * provider behind getVocabulary, the expansion and the ranking are cheap.
 *
 * Product.concepts holds the concepts assigned to the product and all their ancestors. expandConcepts takes that
 * list as it is, recognises the assigned concepts (the ones that are no ancestor of another) and expands only
 * those, so an ancestor is reached as broader and not as an exact match with all its other children as narrower.
 * Pass directConcepts when the assigned concepts are known, it overrides the recognition.
 *
 * @example PDP, articles that share concepts with the product, boosted by what the visitor is interested in
 * ```ts
 * const context = await client.taxonomy.expandConcepts({ concepts: product.concepts });
 * const affinity = await client.taxonomy.expandAffinities({ affinities: profile.affinities });
 * const ranked = await client.taxonomy.rankByConcepts({
 *   items: articles.map((a) => ({ key: a.id, concepts: a.conceptIds })),
 *   context: context.success ? context.value : [],
 *   affinity: affinity.success ? affinity.value : [],
 *   personalization: { mode: 'blend', strength: 0.5 },
 * });
 * ```
 */
export abstract class TaxonomyCapability<
  TVocabulary extends Vocabulary = Vocabulary,
  TConcept extends Concept = Concept,
> extends BaseCapability {
  /**
   * Gets a vocabulary with the tree of its concepts, localized for the request locale.
   *
   * Usecase: You are rendering a navigation or filter tree for a vocabulary, e.g. all features,
   * and need the parent child structure of the concepts.
   */
  public abstract getVocabulary(payload: TaxonomyQueryGetVocabulary): Promise<Result<TVocabulary, NotFoundError>>;

  /**
   * Gets concepts by their identifiers, localized for the request locale. Concepts that do not exist are left out.
   *
   * Usecase: You have concept ids from a search filter, a url or a marketing system, and need their names.
   */
  public abstract getConcepts(payload: TaxonomyQueryGetConcepts): Promise<Result<TConcept[]>>;

  /**
   * The weights and limits every expansion starts from. A policy given with a call wins over these.
   * Override to tune the weights of a project.
   */
  protected defaultExpansionPolicy(): ConceptExpansionPolicy {
    return { ...DEFAULT_EXPANSION_POLICY };
  }

  /**
   * Loads the vocabularies and indexes their concepts. A vocabulary the provider does not know is skipped,
   * any other failure of getVocabulary is returned as it is.
   */
  protected async loadConceptIndex(vocabularies: string[]): Promise<Result<ConceptIndex>> {
    const unique = [...new Set(vocabularies.filter((vocabulary) => vocabulary !== ''))];
    if (unique.length > MAX_VOCABULARIES_PER_CALL) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `The call reaches ${unique.length} vocabularies, at most ${MAX_VOCABULARIES_PER_CALL} are supported.`,
      });
    }
    const results: Array<Result<TVocabulary, NotFoundError> | undefined> = new Array(unique.length).fill(undefined);
    let next = 0;
    const worker = async () => {
      while (next < unique.length) {
        const position = next++;
        results[position] = await this.getVocabulary({ vocabulary: { key: unique[position] } });
      }
    };
    await Promise.all(Array.from({ length: Math.min(VOCABULARY_CONCURRENCY, unique.length) }, worker));

    const loaded: Vocabulary[] = [];
    for (const result of results) {
      if (result?.success) {
        loaded.push(result.value);
      } else if (result && result.error.type !== 'NotFound') {
        return result;
      }
    }
    return success(buildConceptIndex(loaded));
  }

  protected resolveExpansionPolicy(policy: ConceptExpansionPolicy | undefined): ConceptExpansionPolicy {
    const given = Object.fromEntries(Object.entries(policy ?? {}).filter(([, value]) => value !== undefined));
    return { ...this.defaultExpansionPolicy(), ...given };
  }

  /**
   * Gets the concepts around concepts: their ancestors (broader), descendants (narrower) and related concepts.
   *
   * Usecase: You show "more in this area" for a concept, or want to know what a concept is part of.
   */
  @Reactionary({
    inputSchema: TaxonomyQueryGetRelatedConceptsSchema,
    outputSchema: z.array(RelatedConceptSchema),
    cache: false,
  })
  public async getRelatedConcepts(payload: TaxonomyQueryGetRelatedConcepts): Promise<Result<RelatedConcept[]>> {
    const keys = payload.concepts.map((concept) => concept.key);
    const loaded = await this.loadConceptIndex(keys.map(vocabularyOfConceptId));
    if (!loaded.success) {
      return loaded;
    }
    return success(
      findRelatedConcepts(loaded.value, keys, { relations: payload.relations, maxDepth: payload.maxDepth }),
    );
  }

  /**
   * Expands concepts, typically Product.concepts, to the concepts around them with a weight: the concepts
   * themselves (exact), their descendants (narrower), related concepts and ancestors (broader). The result is
   * sorted by weight and is the context for rankByConcepts. The vocabularies to load come from the concepts, plus
   * the extra ones of the policy.
   *
   * The concepts are expected to be the closure over the ancestors, like Product.concepts: only the assigned
   * concepts are expanded, see directConcepts and splitDirectAndBroader. A given directConcepts is authoritative:
   * exactly those ids are expanded, also ids that are not in concepts.
   *
   * The result holds at most 2000 concepts, the exact ones first and then the highest weights, which is what
   * rankByConcepts takes as context.
   *
   * Usecase: PDP, find the CMS articles that share concepts with the product shown.
   */
  @Reactionary({
    inputSchema: TaxonomyQueryExpandConceptsSchema,
    outputSchema: z.array(ExpandedConceptSchema),
    cache: false,
  })
  public async expandConcepts(payload: TaxonomyQueryExpandConcepts): Promise<Result<ExpandedConcept[]>> {
    const policy = this.resolveExpansionPolicy(payload.policy);
    const vocabularies = [
      ...payload.concepts.map((concept) => concept.vocabulary || vocabularyOfConceptId(concept.identifier.key)),
      ...(payload.directConcepts ?? []).map((concept) => vocabularyOfConceptId(concept.key)),
      ...(policy.vocabularies ?? []),
    ];
    const loaded = await this.loadConceptIndex(vocabularies);
    if (!loaded.success) {
      return loaded;
    }

    // Product.concepts holds the ancestors too, only the assigned concepts are expanded, the ancestors are
    // reached through the walk up from them. A given directConcepts is authoritative, its ids are the seeds.
    let seeds: ConceptSeed[];
    if (payload.directConcepts && payload.directConcepts.length > 0) {
      const given = new Map(payload.concepts.map((concept) => [concept.identifier.key, concept]));
      seeds = payload.directConcepts.map((direct) => ({
        identifier: { key: direct.key },
        vocabulary: vocabularyOfConceptId(direct.key),
        parent: given.get(direct.key)?.parent,
      }));
    } else {
      const directIds = new Set(splitDirectAndBroader(payload.concepts).direct);
      seeds = payload.concepts.filter((concept) => directIds.has(concept.identifier.key));
    }
    return success(limitExpansion(expandConcepts(loaded.value, seeds, policy)));
  }

  /**
   * Expands the interests of a visitor, the affinities of the personalization profile, the same way as
   * expandConcepts. Only the top N affinities count and, if the highest is above 1, they are scaled down by it,
   * so arbitrary large scores cannot swamp relevance. Weights within (0, 1], like the banded ones of a profile,
   * are kept as they are. The result holds at most 2000 concepts, the exact ones first and then the highest weights.
   *
   * The affinities are personal data: the result is never cached. Call it on the server only.
   */
  @Reactionary({
    inputSchema: TaxonomyQueryExpandAffinitiesSchema,
    outputSchema: z.array(ExpandedConceptSchema),
    cache: false,
  })
  public async expandAffinities(payload: TaxonomyQueryExpandAffinities): Promise<Result<ExpandedConcept[]>> {
    const policy = this.resolveExpansionPolicy(payload.policy);
    const seeds = affinitiesToSeeds(payload.affinities, { topN: payload.topN });
    const loaded = await this.loadConceptIndex([
      ...seeds.map((seed) => seed.vocabulary ?? ''),
      ...(policy.vocabularies ?? []),
    ]);
    if (!loaded.success) {
      return loaded;
    }
    return success(limitExpansion(expandConcepts(loaded.value, seeds, policy)));
  }

  /**
   * Ranks items, e.g. CMS articles, by the concepts they share with a context, optionally reordered by the
   * interests of the visitor. Relevance is the score against the context, affinity the score against the
   * profile. In the default blend mode the score is relevance * (1 + strength * affinity), so the profile only
   * reorders relevant items and adds at most the strength. See rankItems for all modes.
   *
   * Nothing is fetched or cached, the payload may hold the expanded interests of a person.
   *
   * The payload is validated strictly: negative weights, a strength outside 0..1 and more than 2000 concepts in
   * the context or the affinity fail as InvalidInput. (The pure rankItems it uses is lenient and clamps.)
   */
  @Reactionary({
    inputSchema: TaxonomyQueryRankByConceptsSchema,
    outputSchema: z.array(ConceptRankedItemSchema),
    cache: false,
  })
  public async rankByConcepts(payload: TaxonomyQueryRankByConcepts): Promise<Result<ConceptRankedItem[]>> {
    return success(
      rankItems(payload.items, {
        context: payload.context,
        affinity: payload.affinity,
        personalization: payload.personalization,
      }),
    );
  }

  protected override getResourceName(): string {
    return 'taxonomy';
  }
}
