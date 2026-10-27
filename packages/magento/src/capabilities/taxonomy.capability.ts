import type {
  GenericError,
  NotFoundError,
  Result,
  TaxonomyQueryGetConcepts,
  TaxonomyQueryGetVocabulary,
} from '@reactionary/core';
import {
  error,
  Reactionary,
  TaxonomyCapability,
  TaxonomyQueryGetConceptsSchema,
  TaxonomyQueryGetVocabularySchema,
  ConceptSchema,
  VocabularySchema,
} from '@reactionary/core';
import * as z from 'zod';

/**
 * Magento has no taxonomy that maps to the TaxonomyCapability, both methods answer with a generic error, so a project can
 * subclass this and implement the taxonomy against its own data.
 */
export class MagentoTaxonomyCapability extends TaxonomyCapability {
  @Reactionary({
    inputSchema: TaxonomyQueryGetVocabularySchema,
    outputSchema: VocabularySchema,
  })
  public override async getVocabulary(
    _payload: TaxonomyQueryGetVocabulary,
  ): Promise<Result<z.output<typeof VocabularySchema>, NotFoundError>> {
    return error<GenericError>({
      type: 'Generic',
      message: 'Magento does not support the taxonomy capability',
    });
  }

  @Reactionary({
    inputSchema: TaxonomyQueryGetConceptsSchema,
    outputSchema: z.array(ConceptSchema),
  })
  public override async getConcepts(
    _payload: TaxonomyQueryGetConcepts,
  ): Promise<Result<Array<z.output<typeof ConceptSchema>>>> {
    return error<GenericError>({
      type: 'Generic',
      message: 'Magento does not support the taxonomy capability',
    });
  }
}
