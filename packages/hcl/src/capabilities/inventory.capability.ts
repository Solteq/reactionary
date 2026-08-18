import {
  InventoryCapability,
  InventoryQueryBySKUSchema,
  InventorySchema,
  Reactionary,
  error,
  success,
  type Cache,
  type InventoryFactory,
  type InventoryFactoryOutput,
  type InventoryFactoryWithOutput,
  type InventoryQueryBySKU,
  type NotFoundError,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { HclInventoryAvailabilityResponse } from '../schema/hcl.schema.js';

export class HclInventoryCapability<
  TFactory extends InventoryFactory = HclInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: InventoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(
    payload: InventoryQueryBySKU,
  ): Promise<Result<InventoryFactoryOutput<TFactory>, NotFoundError>> {
    const { sku } = payload.variant;
    const centreKey = payload.fulfilmentCenter.key;

    const response = await this.client.callGet<HclInventoryAvailabilityResponse>(
      this.getBySKUUrl(payload),
      this.getBySKUPayload(payload),
    );

    const items = response.InventoryAvailability ?? [];

    // For a physical store request, match by physicalStoreName.
    // For online (empty key), match the first record without a physicalStoreId,
    // or fall back to the first record if none can be distinguished.
    let item = items.find((i) =>
      centreKey ? i.physicalStoreName === centreKey : !i.physicalStoreId,
    );

    if (!item && items.length > 0) {
      item = items[0];
    }

    if (!item) {
      const notFound: NotFoundError = {
        type: 'NotFound',
        identifier: { variant: { sku }, fulfillmentCenter: { key: centreKey } },
      };
      return error(notFound);
    }

    return success(
      this.factory.parseInventory(this.context, {
        item,
        sku,
        fulfilmentCenterKey: centreKey,
      }) as InventoryFactoryOutput<TFactory>,
    );
  }

  protected getBySKUUrl(payload: InventoryQueryBySKU): string {
    return `${this.client.transactionBaseUrl}/inventoryavailability/byPartNumber/${encodeURIComponent(payload.variant.sku)}`;
  }

  protected getBySKUPayload(payload: InventoryQueryBySKU): URLSearchParams {
    const params = new URLSearchParams();
    const centreKey = payload.fulfilmentCenter.key;
    if (centreKey) params.set('physicalStoreName', centreKey);
    return params;
  }
}
