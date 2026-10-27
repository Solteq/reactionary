import { describe, expect, it } from 'vitest';
import { ConceptSchema, VocabularySchema } from '../schemas/models/taxonomy.model.js';
import { TaxonomyQueryGetConceptsSchema, TaxonomyQueryGetVocabularySchema } from '../schemas/queries/taxonomy.query.js';

describe('Taxonomy schemas', () => {
  it('parses a vocabulary with a nested concept tree', () => {
    const vocabulary = VocabularySchema.parse({
      identifier: { key: 'features' },
      name: 'Features',
      concepts: [
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

    expect(vocabulary.concepts[0].children?.[0].identifier.key).toBe('features/cordless');
    expect(vocabulary.concepts[0].children?.[0].parent?.key).toBe('features/power');
    expect(vocabulary.concepts[0].children?.[0].children).toBeUndefined();
    expect(vocabulary.concepts[0].synonyms).toBeUndefined();
  });

  it('parses the optional SKOS fields', () => {
    const concept = ConceptSchema.parse({
      identifier: { key: 'features/cordless' },
      vocabulary: 'features',
      name: 'Cordless',
      notation: 'C-01',
      definition: 'Runs on a battery',
      related: [{ key: 'features/battery' }],
    });

    expect(concept.notation).toBe('C-01');
    expect(concept.definition).toBe('Runs on a battery');
    expect(concept.related?.[0].key).toBe('features/battery');
  });

  it('rejects a concept without a vocabulary', () => {
    expect(ConceptSchema.safeParse({ identifier: { key: 'features/cordless' }, name: 'Cordless' }).success).toBe(false);
  });

  it('validates the query payloads', () => {
    expect(TaxonomyQueryGetVocabularySchema.safeParse({ vocabulary: { key: 'features' } }).success).toBe(true);
    expect(TaxonomyQueryGetVocabularySchema.safeParse({ vocabulary: 'features' }).success).toBe(false);
    expect(TaxonomyQueryGetConceptsSchema.safeParse({ concepts: [{ key: 'features/cordless' }] }).success).toBe(true);
    expect(TaxonomyQueryGetConceptsSchema.safeParse({ concepts: ['features/cordless'] }).success).toBe(false);
  });
});
