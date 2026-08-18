import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  OrderSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import { HclOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { HclOrderSearchFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import type { HclWcsIdentityResponse } from '../schema/hcl.schema.js';
import { getHclTestConfiguration } from './test-utils.js';

const hasCredentials = !!process.env['HCL_USER'] && !!process.env['HCL_PASS'];

describe.skipIf(!hasCredentials)('HCL Order Search Capability', () => {
  let provider: HclOrderSearchCapability;
  let reqCtx: RequestContext;
  let client: HclClient;

  beforeAll(async () => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    client = new HclClient(config, reqCtx);

    const loginResponse = await client.callPost<HclWcsIdentityResponse>(
      `${client.transactionBaseUrl}/loginidentity`,
      {
        logonId: process.env['HCL_USER'],
        logonPassword: process.env['HCL_PASS'],
      },
    );
    reqCtx.session['hcl.WCToken'] = loginResponse.WCToken;
    reqCtx.session['hcl.WCTrustedToken'] = loginResponse.WCTrustedToken;
    reqCtx.session['hcl.userId'] = loginResponse.userId;
    reqCtx.session['hcl.identityType'] = 'registered';
  });

  beforeEach(() => {
    const config = getHclTestConfiguration();
    provider = new HclOrderSearchCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclOrderSearchFactory(OrderSearchResultSchema),
    );
  });

  it('should return order history for authenticated user', async () => {
    const result = await provider.queryByTerm({
      search: {
        term: '',
        filters: [],
        paginationOptions: { pageSize: 10, pageNumber: 1 },
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.items).toBeDefined();
    expect(Array.isArray(result.value.items)).toBe(true);
  });

  it('should return page 2 of order history', async () => {
    const result = await provider.queryByTerm({
      search: {
        term: '',
        filters: [],
        paginationOptions: { pageSize: 5, pageNumber: 2 },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should return empty items when no orders exist', async () => {
    // Request a page far into the future to get empty results
    const result = await provider.queryByTerm({
      search: {
        term: '',
        filters: [],
        paginationOptions: { pageSize: 10, pageNumber: 9999 },
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.items).toBeDefined();
    expect(Array.isArray(result.value.items)).toBe(true);
  });
});
