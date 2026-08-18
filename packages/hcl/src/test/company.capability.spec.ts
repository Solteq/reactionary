// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CompanyPaginatedListSchema,
  CompanySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { HclCompanyCapability } from '../capabilities/company.capability.js';
import { HclCompanyFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';

const hasCredentials = !!process.env['HCL_USER'] && !!process.env['HCL_PASS'];

describe.skipIf(!hasCredentials)('HCL Company Capability', () => {
  let provider: HclCompanyCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclCompanyCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclCompanyFactory(CompanySchema, CompanyPaginatedListSchema),
    );
  });

  it('should list companies the current user can admin', async () => {
    const result = await provider.listCompanies({
      search: { paginationOptions: { pageNumber: 1, pageSize: 10 } },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(Array.isArray(result.value.items)).toBe(true);
    expect(typeof result.value.totalCount).toBe('number');
  });

  it('should return an error for a non-existent org ID', async () => {
    const result = await provider.getById({
      identifier: { taxIdentifier: 'non-existent-org-id-xyz' },
    });

    expect(result.success).toBe(false);
  });

  it('should fetch a known company by identifier', async () => {
    const list = await provider.listCompanies({
      search: { paginationOptions: { pageNumber: 1, pageSize: 5 } },
    });

    assert(list.success, `Expected success, got: ${JSON.stringify(list)}`);

    if (list.value.items.length === 0) {
      console.warn('No companies on demo server — skipping getById test');
      return;
    }

    const firstCompany = list.value.items[0];
    const result = await provider.getById({
      identifier: firstCompany.identifier,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.name).toBeTruthy();
    expect(result.value.identifier).toBeDefined();
    expect(['active', 'blocked']).toContain(result.value.status);
  });
});
