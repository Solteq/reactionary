import { describe, expect, it } from 'vitest';
import { createClient } from '../v2/core/capability-client.js';
import { createInitialRequestContext } from '../initialization.js';
import { success } from '../schemas/result.js';
import type { AnalyticsMutation } from '../schemas/index.js';

describe('V2 Capability Client', () => {
  it('multicasts analytics track events across providers', async () => {
    const primaryEvents: AnalyticsMutation[] = [];
    const secondaryEvents: AnalyticsMutation[] = [];

    const withPrimary = () => ({
      analytics: {
        track: {
          execute: async (event: AnalyticsMutation) => {
            primaryEvents.push(event);
            return success(undefined);
          },
        },
      },
    });

    const withSecondary = () => ({
      analytics: {
        track: {
          execute: async (event: AnalyticsMutation) => {
            secondaryEvents.push(event);
            return success(undefined);
          },
        },
      },
    });

    const client = createClient(
      { request: createInitialRequestContext() },
      withPrimary,
      withSecondary,
    );

    const event = {
      event: 'product-details-view',
      product: { key: 'P-1000' },
    } satisfies AnalyticsMutation;

    const response = await client.analytics.track.execute(event);
    expect(response.success).toBe(true);
    expect(primaryEvents).toEqual([event]);
    expect(secondaryEvents).toEqual([event]);
  });

  it('still merges non-analytics capabilities', () => {
    const withProductSearch = () => ({
      productSearch: {
        byTerm: {
          execute: async () => success({
            identifier: {
              term: '',
              facets: [],
              filters: [],
              paginationOptions: { pageNumber: 1, pageSize: 1 },
            },
            pageNumber: 1,
            pageSize: 1,
            totalCount: 0,
            totalPages: 0,
            items: [],
            facets: [],
          }),
        },
      },
    });

    const client = createClient(
      { request: createInitialRequestContext() },
      withProductSearch,
    );

    expect(client.productSearch.byTerm).toBeDefined();
    expect('analytics' in client).toBe(false);
  });
});
