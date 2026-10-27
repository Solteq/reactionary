import type { NotFoundError } from '../schemas/errors/not-found.error.js';
import type { Concept, Vocabulary } from '../schemas/models/taxonomy.model.js';
import type { TaxonomyQueryGetConcepts, TaxonomyQueryGetVocabulary } from '../schemas/queries/taxonomy.query.js';
import type { Result } from '../schemas/result.js';
import { BaseCapability } from './base.capability.js';

/**
 * TaxonomyCapability
 *
 * Gives access to the taxonomy that products are classified with: vocabularies of concepts, e.g. "features"
 * with features/cordless. Products carry their concepts on Product.concepts, search results on the item concepts
 * and in the concept facets. This capability resolves the concepts behind those references.
 */
export abstract class TaxonomyCapability<
  TVocabulary extends Vocabulary = Vocabulary,
  TTerm extends Concept = Concept,
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
  public abstract getConcepts(payload: TaxonomyQueryGetConcepts): Promise<Result<TTerm[]>>;

  protected override getResourceName(): string {
    return 'taxonomy';
  }
}
