import { describe, expect, it } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  type ProductRecommendationBaseQuery,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { AlgoliaProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { AlgoliaConfigurationSchema } from '../schema/configuration.schema.js';
import { AlgoliaPersonalization } from '../core/personalization.js';

class TestableSearch extends AlgoliaProductSearchCapability {
  public buildQuery(payload: ProductSearchQueryByTerm) {
    return this.queryByTermPayload(payload);
  }
}

class TestableRecommendations extends AlgoliaProductRecommendationsCapability {
  public buildParameters(labels?: string[]) {
    const query: ProductRecommendationBaseQuery = { numberOfRecommendations: 4, labels, personalizationProfile: profile };
    return this.getQueryParametersForRecommendations('related', query);
  }
}

const profile = {
  identifier: { key: 'visitor-1' },
  segments: ['vip', 'affinity.features.cordless.high', 'lapsed'],
  affinities: { 'features/cordless': 1, 'application/power-tools': 0.6, 'trade/carpenter': 0.3 },
  blurb: '',
};

const config = (extra: Record<string, unknown> = {}) => AlgoliaConfigurationSchema.parse({ appId: 'app', apiKey: 'key', indexName: 'products', ...extra });

const search = (extra: Record<string, unknown> = {}) =>
  new TestableSearch(new NoOpCache(), createInitialRequestContext(), config(extra), new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema));

const query = (personalizationProfile?: typeof profile): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 } },
    personalizationProfile,
  });

describe('Algolia search personalization', () => {
  it('sends neither contexts nor optional filters without a profile', () => {
    const sent = search().buildQuery(query());

    expect(sent.ruleContexts).toEqual([]);
    expect(sent).not.toHaveProperty('optionalFilters');
    expect(sent.userToken).toBe('anonymous');
  });

  it('sends the segments as contexts, and the interests as optional filters', () => {
    const sent = search().buildQuery(query(profile));

    expect(sent.ruleContexts).toEqual(['segment_lapsed', 'segment_vip']);
    expect(sent.optionalFilters).toEqual(['conceptIds:features/cordless<score=10>', 'conceptIds:application/power-tools<score=6>']);
    expect(sent.userToken).toBe('visitor-1');
  });

  it('sends only the allowed segments as contexts, and still ranks by interest', () => {
    const sent = search({ ruleContextSegments: ['vi*'] }).buildQuery(query(profile));

    expect(sent.ruleContexts).toEqual(['segment_vip']);
    expect(sent.optionalFilters).toHaveLength(2);
  });
});

describe('Algolia recommendations personalization', () => {
  const recommendations = (extra: Record<string, unknown> = {}) =>
    new TestableRecommendations(config(extra), new NoOpCache(), createInitialRequestContext());

  it('sends the segments as contexts after the labels have taken their room, and the interests as optional filters', () => {
    const sent = recommendations().buildParameters(['pdp']);

    expect(sent.ruleContexts).toEqual(['segment_lapsed', 'segment_vip', 'pdp']);
    expect(sent.optionalFilters).toEqual(['conceptIds:features/cordless<score=10>', 'conceptIds:application/power-tools<score=6>']);
  });

  it('leaves the segments out when the labels take all the room', () => {
    const labels = Array.from({ length: 10 }, (_, i) => `label${i}`);

    expect(recommendations().buildParameters(labels).ruleContexts).toEqual(labels);
  });
});

describe('Algolia personalization in a capability subclass', () => {
  class Shouting extends AlgoliaPersonalization {
    protected override ruleContextOf(segment: string): string {
      return `shout_${segment}`;
    }
  }

  it('can make search use another personalization', () => {
    class Search extends TestableSearch {
      protected override personalization() {
        return new Shouting(this.config);
      }
    }
    const sent = new Search(new NoOpCache(), createInitialRequestContext(), config(), new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema)).buildQuery(
      query(profile),
    );

    expect(sent.ruleContexts).toEqual(['shout_lapsed', 'shout_vip']);
  });

  it('can make recommendations use another personalization', () => {
    class Recommendations extends TestableRecommendations {
      protected override personalization() {
        return new Shouting(this.config);
      }
    }
    const sent = new Recommendations(config(), new NoOpCache(), createInitialRequestContext()).buildParameters(['pdp']);

    expect(sent.ruleContexts).toEqual(['shout_lapsed', 'shout_vip', 'pdp']);
  });

  it('can change the contexts or the filters of one capability without a personalization of its own', () => {
    class Search extends TestableSearch {
      protected override ruleContextsOf(): string[] {
        return ['only-this'];
      }

      protected override optionalFiltersOf(): string[] {
        return ['conceptIds:x/y<score=1>'];
      }
    }
    const sent = new Search(new NoOpCache(), createInitialRequestContext(), config(), new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema)).buildQuery(
      query(profile),
    );

    expect(sent.ruleContexts).toEqual(['only-this']);
    expect(sent.optionalFilters).toEqual(['conceptIds:x/y<score=1>']);
  });
});
