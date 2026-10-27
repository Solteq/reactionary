import { assert, describe, expect, it } from 'vitest';
import type { StoreProductTag } from '@medusajs/types';
import {
  createInitialRequestContext,
  NoOpCache,
  TermSchema,
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
    metadata: externalId ? { term_id: externalId, ...metadata } : metadata,
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
    new MedusaTaxonomyFactory(TermSchema, VocabularySchema),
  );
  capability['tagPageSize'] = 2;
  return capability;
}

describe('Medusa taxonomy capability', () => {
  it('builds the term tree of a vocabulary from its tags, across pages', async () => {
    const capability = createCapability();

    const result = await capability.getVocabulary({ vocabulary: { key: 'features' } });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.identifier.key).toBe('features');
    expect(result.value.name).toBe('Features');
    // a term whose parent is not among the tags is a root term
    expect(result.value.terms.map((t) => t.identifier.key)).toEqual(['features/power', 'features/outdoor-rated']);
    const power = result.value.terms[0];
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
    const result = await createCapability('da-DK').getTerms({ terms: [{ key: 'features/cordless' }] });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value[0].synonyms).toEqual(['batteridrevet']);
  });

  it('returns NotFound for a vocabulary without terms', async () => {
    const result = await createCapability().getVocabulary({ vocabulary: { key: 'unknown' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('looks terms up by their ids, in request order, leaving out the unknown ones', async () => {
    const capability = createCapability();

    const result = await capability.getTerms({
      terms: [{ key: 'brands/acme' }, { key: 'features/cordless' }, { key: 'features/nope' }],
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
