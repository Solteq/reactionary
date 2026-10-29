import { assert, describe, expect, it } from 'vitest';
import type { StoreProductTag } from '@medusajs/types';
import {
  createInitialRequestContext,
  MemoryCache,
  NoOpCache,
  ConceptSchema,
  VocabularySchema,
  type Cache,
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

function createCapability(locale = 'en-US', cache: Cache = new NoOpCache()) {
  const context = createInitialRequestContext();
  context.languageContext.locale = locale;
  const capability = new InMemoryTaxonomyCapability(
    getMedusaTestConfiguration(),
    cache,
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

  it('serves getConcepts from the cache, also to another request', async () => {
    const cache = new MemoryCache();
    const first = createCapability('en-US', cache);
    const second = createCapability('en-US', cache);

    const fromBackend = await first.getConcepts({ concepts: [{ key: 'features/cordless' }] });
    // the cache is written without being waited for
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fromCache = await second.getConcepts({ concepts: [{ key: 'features/cordless' }] });

    if (!fromBackend.success || !fromCache.success) {
      assert.fail();
    }
    expect(first.requests).toHaveLength(1);
    expect(second.requests).toHaveLength(0);
    expect(fromCache.value).toEqual(fromBackend.value);
  });

  it('answers an unknown id with an empty list and serves that from the cache too', async () => {
    const cache = new MemoryCache();
    const first = createCapability('en-US', cache);
    const second = createCapability('en-US', cache);

    const unknown = await first.getConcepts({ concepts: [{ key: 'features/not-there' }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const again = await second.getConcepts({ concepts: [{ key: 'features/not-there' }] });

    if (!unknown.success || !again.success) {
      assert.fail();
    }
    expect(unknown.value).toEqual([]);
    expect(again.value).toEqual([]);
    expect(second.requests).toHaveLength(0);
  });

  it('caches getConcepts apart for each locale', async () => {
    const cache = new MemoryCache();
    await createCapability('en-US', cache).getConcepts({ concepts: [{ key: 'features/cordless' }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const danish = createCapability('da-DK', cache);

    const result = await danish.getConcepts({ concepts: [{ key: 'features/cordless' }] });

    if (!result.success) {
      assert.fail();
    }
    expect(danish.requests).toHaveLength(1);
    expect(result.value[0].synonyms).toEqual(['batteridrevet']);
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

  it('maps notation, the localized definition and related concepts', async () => {
    const original = [...tags];
    tags.push(
      tag('skos/full', 'Full', {
        vocabulary: 'skos',
        notation: 'F-1',
        definition: { en: 'English definition', da: 'Dansk definition' },
        related: ['skos/other', 'brands/acme'],
      }),
      tag('skos/language', 'Language', { vocabulary: 'skos', definition: { en: 'English', da: 'Dansk' } }),
      tag('skos/fallback', 'Fallback', { vocabulary: 'skos', definition: { en: 'Only english' } }),
      tag('skos/garbage', 'Garbage', {
        vocabulary: 'skos',
        notation: 42,
        definition: ['not', 'a', 'map'],
        related: 'skos/full',
      }),
      tag('skos/mixed', 'Mixed', {
        vocabulary: 'skos',
        notation: '',
        definition: { en: 3 },
        related: ['skos/full', 7, null, '', 'skos/full', 'skos/mixed', { key: 'x' }],
      }),
      tag('skos/plain', 'Plain', { vocabulary: 'skos', definition: 'A plain definition' }),
    );

    try {
      const result = await createCapability('da-DK').getConcepts({
        concepts: ['skos/full', 'skos/language', 'skos/fallback', 'skos/garbage', 'skos/mixed', 'skos/plain'].map((key) => ({ key })),
      });

      if (!result.success) {
        assert.fail();
      }
      const [full, language, fallback, garbage, mixed, plain] = result.value;
      expect(full).toMatchObject({
        notation: 'F-1',
        definition: 'Dansk definition',
        related: [{ key: 'skos/other' }, { key: 'brands/acme' }],
      });
      expect(language.definition).toBe('Dansk');
      expect(fallback.definition).toBe('Only english');
      expect(plain.definition).toBe('A plain definition');
      for (const concept of [garbage, mixed]) {
        expect(concept.notation).toBeUndefined();
        expect(concept.definition).toBeUndefined();
      }
      expect(garbage.related).toBeUndefined();
      expect(mixed.related).toEqual([{ key: 'skos/full' }]);
      // a concept without the SKOS metadata stays as before
      const plainResult = await createCapability().getConcepts({ concepts: [{ key: 'brands/acme' }] });
      if (!plainResult.success) {
        assert.fail();
      }
      expect(plainResult.value[0].notation).toBeUndefined();
      expect(plainResult.value[0].definition).toBeUndefined();
      expect(plainResult.value[0].related).toBeUndefined();
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
