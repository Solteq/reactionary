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
import type { HclTransactionClient } from '../core/transaction-client.js';
import type { HclInventoryFactory } from '../factories/inventory/inventory.factory.js';

export class HclInventoryCapability<
  TFactory extends InventoryFactory = HclInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly transactionClient: HclTransactionClient,
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

    // Pass physicalStoreName when a specific fulfilment centre is requested.
    const physicalStoreName = centreKey || undefined;

    const response = await this.transactionClient.getInventoryByPartNumber(
      [sku],
      physicalStoreName,
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
}
