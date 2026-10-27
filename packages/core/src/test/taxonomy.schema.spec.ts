import { describe, expect, it } from 'vitest';
import { TermSchema, VocabularySchema } from '../schemas/models/taxonomy.model.js';
import { TaxonomyQueryGetTermsSchema, TaxonomyQueryGetVocabularySchema } from '../schemas/queries/taxonomy.query.js';

describe('Taxonomy schemas', () => {
  it('parses a vocabulary with a nested term tree', () => {
    const vocabulary = VocabularySchema.parse({
      identifier: { key: 'features' },
      name: 'Features',
      terms: [
        {
          identifier: { key: 'features/power' },
          vocabulary: 'features',
          name: 'Power',
          children: [
            {
              identifier: { key: 'features/cordless' },
              vocabulary: 'features',
              name: 'Cordless',
              synonyms: ['battery powered'],
              parent: { key: 'features/power' },
            },
          ],
        },
      ],
    });

    expect(vocabulary.terms[0].children?.[0].identifier.key).toBe('features/cordless');
    expect(vocabulary.terms[0].children?.[0].parent?.key).toBe('features/power');
    expect(vocabulary.terms[0].children?.[0].children).toBeUndefined();
    expect(vocabulary.terms[0].synonyms).toBeUndefined();
  });

  it('rejects a term without a vocabulary', () => {
    expect(TermSchema.safeParse({ identifier: { key: 'features/cordless' }, name: 'Cordless' }).success).toBe(false);
  });

  it('validates the query payloads', () => {
    expect(TaxonomyQueryGetVocabularySchema.safeParse({ vocabulary: { key: 'features' } }).success).toBe(true);
    expect(TaxonomyQueryGetVocabularySchema.safeParse({ vocabulary: 'features' }).success).toBe(false);
    expect(TaxonomyQueryGetTermsSchema.safeParse({ terms: [{ key: 'features/cordless' }] }).success).toBe(true);
    expect(TaxonomyQueryGetTermsSchema.safeParse({ terms: ['features/cordless'] }).success).toBe(false);
  });
});
