import { assert, describe, expect, it } from 'vitest';
import type { StoreProductTag } from '@medusajs/types';
import {
  createInitialRequestContext,
  NoOpCache,
  ConceptSchema,
  VocabularySchema,
} from '@reactionary/core';
import { MedusaTaxonomyCapability } from '../capabilities/taxonomy.capability.js';
import { MedusaTaxonomyFactory } from '../factories/taxonomy/taxonomy.factory.js';
import { MedusaAPI } from '../index.js';
import { getMedusaTestConfiguration } from './test-utils.js';

function tag(
  externalId: string | null,
  value: string,
  metadata: Record<string, unknown> = {},
): StoreProductTag {
  return {
    id: `ptag_${externalId ?? value}`,
    value,
    external_id: externalId,
    created_at: '',
    updated_at: '',
    metadata: externalId ? { concept_id: externalId, ...metadata } : metadata,
  };
}

const tags: StoreProductTag[] = [
  tag('features/power', 'Power', { vocabulary: 'features' }),
  tag('features/cordless', 'Cordless', {
    vocabulary: 'features',
    parent: 'features/power',
    synonyms: { en: ['battery powered'], da: ['batteridrevet'] },
  }),
  tag('features/outdoor-rated', 'Outdoor rated (features/outdoor-rated)', {
    vocabulary: 'features',
    parent: 'features/missing',
  }),
  tag('brands/acme', 'Acme', { vocabulary: 'brands' }),
  tag(null, 'Plain tag'),
];

/**
 * Serves the tags from memory, with the paging and external_id filtering of the store API.
 */
class InMemoryTaxonomyCapability extends MedusaTaxonomyCapability {
  public requests: Array<Record<string, unknown>> = [];

  protected override async listTags(query: Record<string, unknown>) {
    this.requests.push(query);
    const ids = query['external_id'];
    const filtered = Array.isArray(ids) ? tags.filter((t) => t.external_id && ids.includes(t.external_id)) : tags;
    const offset = Number(query['offset'] ?? 0);
    const limit = Number(query['limit'] ?? 50);
    return {
      product_tags: filtered.slice(offset, offset + limit),
      count: filtered.length,
      offset,
      limit,
    };
  }
}

function createCapability(locale = 'en-US') {
  const context = createInitialRequestContext();
  context.languageContext.locale = locale;
  const capability = new InMemoryTaxonomyCapability(
    getMedusaTestConfiguration(),
    new NoOpCache(),
    context,
    new MedusaAPI(getMedusaTestConfiguration(), context),
    new MedusaTaxonomyFactory(ConceptSchema, VocabularySchema),
  );
  capability['tagPageSize'] = 2;
  return capability;
}

describe('Medusa taxonomy capability', () => {
  it('builds the concept tree of a vocabulary from its tags, across pages', async () => {
    const capability = createCapability();

    const result = await capability.getVocabulary({ vocabulary: { key: 'features' } });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.identifier.key).toBe('features');
    expect(result.value.name).toBe('Features');
    // a concept whose parent is not among the tags is a root concept
    expect(result.value.concepts.map((t) => t.identifier.key)).toEqual(['features/power', 'features/outdoor-rated']);
    const power = result.value.concepts[0];
    expect(power.children?.map((t) => t.identifier.key)).toEqual(['features/cordless']);
    expect(power.children?.[0]).toMatchObject({
      parent: { key: 'features/power' },
      synonyms: ['battery powered'],
      vocabulary: 'features',
      name: 'Cordless',
    });
    expect(capability.requests.length).toBeGreaterThan(1);
  });

  it('picks the synonyms of the request locale', async () => {
    const result = await createCapability('da-DK').getConcepts({ concepts: [{ key: 'features/cordless' }] });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value[0].synonyms).toEqual(['batteridrevet']);
  });

  it('breaks parent cycles so that every concept stays reachable', async () => {
    const original = [...tags];
    tags.push(
      tag('loops/a', 'A', { vocabulary: 'loops', parent: 'loops/b' }),
      tag('loops/b', 'B', { vocabulary: 'loops', parent: 'loops/c' }),
      tag('loops/c', 'C', { vocabulary: 'loops', parent: 'loops/a' }),
      tag('loops/d', 'D', { vocabulary: 'loops', parent: 'loops/d' }),
      tag('loops/e', 'E', { vocabulary: 'loops', parent: 'loops/a' }),
      tag('loops/x', 'X', { vocabulary: 'loops', parent: 'loops/y' }),
      tag('loops/y', 'Y', { vocabulary: 'loops', parent: 'loops/x' }),
    );

    try {
      const result = await createCapability().getVocabulary({ vocabulary: { key: 'loops' } });

      if (!result.success) {
        assert.fail();
      }
      const reachable: string[] = [];
      const walk = (concepts: typeof result.value.concepts) => {
        for (const concept of concepts) {
          reachable.push(concept.identifier.key);
          walk(concept.children ?? []);
        }
      };
      walk(result.value.concepts);
      expect(reachable.sort()).toEqual(['loops/a', 'loops/b', 'loops/c', 'loops/d', 'loops/e', 'loops/x', 'loops/y']);
      // the whole tree is plain data, nothing circular reached the schema
      expect(() => JSON.stringify(result.value)).not.toThrow();
      // the concept that would close a loop becomes a root, the others stay attached
      expect(result.value.concepts.map((t) => t.identifier.key)).toEqual(['loops/c', 'loops/d', 'loops/y']);
    } finally {
      tags.length = 0;
      tags.push(...original);
    }
  });

  it('returns NotFound for a vocabulary without concepts', async () => {
    const result = await createCapability().getVocabulary({ vocabulary: { key: 'unknown' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('looks concepts up by their ids, in request order, leaving out the unknown ones', async () => {
    const capability = createCapability();

    const result = await capability.getConcepts({
      concepts: [{ key: 'brands/acme' }, { key: 'features/cordless' }, { key: 'features/nope' }],
    });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.map((t) => [t.identifier.key, t.name, t.vocabulary])).toEqual([
      ['brands/acme', 'Acme', 'brands'],
      ['features/cordless', 'Cordless', 'features'],
    ]);
    // the lookup is chunked by the page size, which the test sets to 2
    expect(capability.requests.map((r) => r['external_id'])).toEqual([
      ['brands/acme', 'features/cordless'],
      ['features/nope'],
    ]);
    expect(result.value[0].children).toBeUndefined();
  });
});
