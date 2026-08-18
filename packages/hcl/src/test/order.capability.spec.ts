import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  OrderSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import { HclOrderCapability } from '../capabilities/order.capability.js';
import { HclOrderFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import type {
  HclWcsIdentityResponse,
  HclWcsOrderListResponse,
} from '../schema/hcl.schema.js';
import { getHclTestConfiguration } from './test-utils.js';

const hasCredentials = !!process.env['HCL_USER'] && !!process.env['HCL_PASS'];

describe.skipIf(!hasCredentials)('HCL Order Capability', () => {
  let provider: HclOrderCapability;
  let reqCtx: RequestContext;
  let client: HclClient;
  let orderId: string | undefined;

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

    // Use env-provided order id, or look up the first one from history
    if (process.env['HCL_ORDER_ID']) {
      orderId = process.env['HCL_ORDER_ID'];
    } else {
      const history = await client.callGet<HclWcsOrderListResponse>(
        `${client.transactionBaseUrl}/order/byStatus/C,S,X,R,D,M,G,F`,
        new URLSearchParams({ maxResults: '1', startIndex: '0' }),
      );
      orderId = history.Order?.[0]?.orderId;
    }
  });

  beforeEach(() => {
    const config = getHclTestConfiguration();
    provider = new HclOrderCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclOrderFactory(OrderSchema),
    );
  });

  it('should return an order by id', async () => {
    if (!orderId) {
      console.warn('No order id available — skipping getById test');
      return;
    }

    const result = await provider.getById({ order: { key: orderId } });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.identifier.key).toBe(orderId);
  });

  it('should return NotFound for unknown order id', async () => {
    const result = await provider.getById({
      order: { key: 'definitely-not-real-99999999' },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('NotFound');
  });
});
