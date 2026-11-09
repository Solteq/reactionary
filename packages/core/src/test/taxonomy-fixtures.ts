import { ConceptSchema, VocabularySchema, type Concept, type Vocabulary } from '../schemas/models/taxonomy.model.js';

export function concept(id: string, extra: Partial<Concept> = {}): Concept {
  const separator = id.indexOf('/');
  return ConceptSchema.parse({
    identifier: { key: id },
    vocabulary: id.slice(0, separator),
    name: id.slice(separator + 1),
    ...extra,
  });
}

export function vocabulary(key: string, concepts: Concept[]): Vocabulary {
  return VocabularySchema.parse({ identifier: { key }, name: key, concepts });
}

/**
 * features
 *   power
 *     cordless (related: outdoor)
 *       battery-18v
 *     corded
 *   outdoor (related, from the other end only: garden)
 *   garden
 * brands
 *   acme (related: features/cordless)
 */
export function createVocabularies(): Vocabulary[] {
  const power = concept('features/power', {
    children: [
      concept('features/cordless', {
        parent: { key: 'features/power' },
        related: [{ key: 'features/outdoor' }],
        children: [concept('features/battery-18v', { parent: { key: 'features/cordless' } })],
      }),
      concept('features/corded', { parent: { key: 'features/power' } }),
    ],
  });
  return [
    vocabulary('features', [
      power,
      concept('features/outdoor'),
      concept('features/garden', { related: [{ key: 'features/outdoor' }] }),
    ]),
    vocabulary('brands', [concept('brands/acme', { related: [{ key: 'features/cordless' }] })]),
  ];
}
