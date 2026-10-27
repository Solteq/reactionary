import type { NotFoundError } from '../schemas/errors/not-found.error.js';
import type { Term, Vocabulary } from '../schemas/models/taxonomy.model.js';
import type { TaxonomyQueryGetTerms, TaxonomyQueryGetVocabulary } from '../schemas/queries/taxonomy.query.js';
import type { Result } from '../schemas/result.js';
import { BaseCapability } from './base.capability.js';

/**
 * TaxonomyCapability
 *
 * Gives access to the taxonomy that products are classified with: vocabularies of terms, e.g. "features"
 * with features/cordless. Products carry their terms on Product.terms, search results on the item terms
 * and in the term facets. This capability resolves the terms behind those references.
 */
export abstract class TaxonomyCapability<
  TVocabulary extends Vocabulary = Vocabulary,
  TTerm extends Term = Term,
> extends BaseCapability {
  /**
   * Gets a vocabulary with the tree of its terms, localized for the request locale.
   *
   * Usecase: You are rendering a navigation or filter tree for a vocabulary, e.g. all features,
   * and need the parent child structure of the terms.
   */
  public abstract getVocabulary(payload: TaxonomyQueryGetVocabulary): Promise<Result<TVocabulary, NotFoundError>>;

  /**
   * Gets terms by their identifiers, localized for the request locale. Terms that do not exist are left out.
   *
   * Usecase: You have term ids from a search filter, a url or a marketing system, and need their names.
   */
  public abstract getTerms(payload: TaxonomyQueryGetTerms): Promise<Result<TTerm[]>>;

  protected override getResourceName(): string {
    return 'taxonomy';
  }
}
