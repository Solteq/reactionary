import { assert, describe, expect, it } from 'vitest';
import { ClientBuilder, NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { withFakeCapabilities } from '../core/initialize.js';
import { getFakerTestConfiguration } from './test-utils.js';

function buildClient(locale?: string) {
  const context = createInitialRequestContext();
  if (locale) {
    context.languageContext.locale = locale;
  }
  return new ClientBuilder(context)
    .withCache(new NoOpCache())
    .withCapability(withFakeCapabilities(getFakerTestConfiguration(), { taxonomy: { enabled: true } }))
    .build();
}

describe('Fake taxonomy capability', () => {
  it('is registered on the client when it is enabled, and only then', () => {
    expect(buildClient().taxonomy).toBeDefined();

    const without = new ClientBuilder(createInitialRequestContext())
      .withCache(new NoOpCache())
      .withCapability(withFakeCapabilities(getFakerTestConfiguration(), { product: { enabled: true } }))
      .build();
    expect('taxonomy' in without).toBe(false);
  });

  it('has the vocabularies features and campaigns with four concepts each', async () => {
    const client = buildClient('en-US');

    const features = await client.taxonomy.getVocabulary({ vocabulary: { key: 'features' } });
    const campaigns = await client.taxonomy.getVocabulary({ vocabulary: { key: 'campaigns' } });

    if (!features.success || !campaigns.success) {
      assert.fail();
    }
    expect(features.value.name).toBe('Features');
    expect(features.value.concepts.map((c) => c.identifier.key)).toEqual([
      'features/cordless',
      'features/outdoor-rated',
      'features/energy-efficient',
      'features/compact',
    ]);
    expect(campaigns.value.concepts).toHaveLength(4);
    expect(campaigns.value.concepts.every((c) => c.identifier.key.startsWith('campaigns/') && c.vocabulary === 'campaigns')).toBe(true);
  });

  it('localizes the names, synonyms and definition and falls back to English', async () => {
    const danish = await buildClient('da-DK').taxonomy.getConcepts({ concepts: [{ key: 'features/cordless' }] });
    const french = await buildClient('fr-FR').taxonomy.getConcepts({ concepts: [{ key: 'features/cordless' }] });

    if (!danish.success || !french.success) {
      assert.fail();
    }
    expect(danish.value[0]).toMatchObject({ name: 'Traadloes', synonyms: ['batteridrevet'], notation: 'F-001' });
    expect(french.value[0]).toMatchObject({ name: 'Cordless', synonyms: ['battery powered'] });
    expect(french.value[0].related).toEqual([{ key: 'features/outdoor-rated' }]);
  });

  it('returns NotFound for an unknown vocabulary', async () => {
    const result = await buildClient().taxonomy.getVocabulary({ vocabulary: { key: 'unknown' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns the known concepts in request order and leaves unknown ones out', async () => {
    const result = await buildClient().taxonomy.getConcepts({
      concepts: [{ key: 'campaigns/sale' }, { key: 'features/nope' }, { key: 'features/compact' }, { key: 'campaigns/sale' }],
    });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.map((c) => c.identifier.key)).toEqual(['campaigns/sale', 'features/compact']);
  });

  it('works with the navigation helpers: expandConcepts and rankByConcepts', async () => {
    const client = buildClient('en-US');

    const context = await client.taxonomy.expandConcepts({
      concepts: [{ identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' }],
    });
    if (!context.success) {
      assert.fail();
    }
    expect(context.value.map((e) => [e.identifier.key, e.weight, e.via])).toEqual([
      ['features/cordless', 1, 'exact'],
      ['features/outdoor-rated', 0.5, 'related'],
    ]);

    const ranked = await client.taxonomy.rankByConcepts({
      items: [
        { key: 'about-compact', concepts: ['features/compact'] },
        { key: 'about-outdoor', concepts: ['features/outdoor-rated'] },
        { key: 'about-cordless', concepts: ['features/cordless', 'features/outdoor-rated'] },
      ],
      context: context.value,
    });
    if (!ranked.success) {
      assert.fail();
    }
    expect(ranked.value.map((r) => r.key)).toEqual(['about-cordless', 'about-outdoor', 'about-compact']);

    const related = await client.taxonomy.getRelatedConcepts({ concepts: [{ key: 'features/cordless' }] });
    if (!related.success) {
      assert.fail();
    }
    expect(related.value.map((r) => [r.concept.key, r.relation])).toEqual([['features/outdoor-rated', 'related']]);
  });
});
