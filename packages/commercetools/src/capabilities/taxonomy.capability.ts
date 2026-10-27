import type {
  GenericError,
  NotFoundError,
  Result,
  TaxonomyQueryGetTerms,
  TaxonomyQueryGetVocabulary,
} from '@reactionary/core';
import {
  error,
  Reactionary,
  TaxonomyCapability,
  TaxonomyQueryGetTermsSchema,
  TaxonomyQueryGetVocabularySchema,
  TermSchema,
  VocabularySchema,
} from '@reactionary/core';
import * as z from 'zod';

/**
 * Commercetools has no taxonomy of its own that maps to the TaxonomyCapability, both methods answer with a generic error, so a project can
 * subclass this and implement the taxonomy against its own data.
 */
export class CommercetoolsTaxonomyCapability extends TaxonomyCapability {
  @Reactionary({
    inputSchema: TaxonomyQueryGetVocabularySchema,
    outputSchema: VocabularySchema,
  })
  public override async getVocabulary(
    _payload: TaxonomyQueryGetVocabulary,
  ): Promise<Result<z.output<typeof VocabularySchema>, NotFoundError>> {
    return error<GenericError>({
      type: 'Generic',
      message: 'Commercetools does not support the taxonomy capability',
    });
  }

  @Reactionary({
    inputSchema: TaxonomyQueryGetTermsSchema,
    outputSchema: z.array(TermSchema),
  })
  public override async getTerms(
    _payload: TaxonomyQueryGetTerms,
  ): Promise<Result<Array<z.output<typeof TermSchema>>>> {
    return error<GenericError>({
      type: 'Generic',
      message: 'Commercetools does not support the taxonomy capability',
    });
  }
}
