import {
  InventoryQueryBySKUSchema,
  InventorySchema,
  error,
  success,
  type InventoryBySkuProcedureDefinition,
} from '@reactionary/core';
import type { Inventory, InventoryIdentifier, InventoryStatus } from '@reactionary/core';
import type { InventoryEntry } from '@commercetools/platform-sdk';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';

function parseCommercetoolsInventory(body: InventoryEntry): Inventory {
  const identifier = {
    variant: { sku: body.sku || '' },
    fulfillmentCenter: {
      key: body.supplyChannel?.obj?.key || '',
    },
  } satisfies InventoryIdentifier;

  const quantity = body.availableQuantity || 0;
  let status: InventoryStatus = 'outOfStock';

  if (quantity > 0) {
    status = 'inStock';
  }

  return {
    identifier,
    quantity,
    status,
  } satisfies Inventory;
}

export const commercetoolsInventoryBySku = commercetoolsProcedure({
  inputSchema: InventoryQueryBySKUSchema,
  outputSchema: InventorySchema,
  fetch: async (query, _context, provider) => {
    const root = await provider.client.getClient();
    const client = root.withProjectKey({ projectKey: provider.config.projectKey });

    try {
      const channel = await client
        .channels()
        .withKey({ key: query.fulfilmentCenter.key })
        .get()
        .execute();

      const channelId = channel.body.id;

      const remote = await client
        .inventory()
        .get({
          queryArgs: {
            where: 'sku=:sku AND supplyChannel(id=:channel)',
            'var.sku': query.variant.sku,
            'var.channel': channelId,
            expand: 'supplyChannel',
          },
        })
        .execute();

      return success(remote.body.results[0]);
    } catch (_err) {
      return error({
        type: 'NotFound',
        identifier: query,
      });
    }
  },
  transform: async (_query, _context, data) => {
    return success(parseCommercetoolsInventory(data));
  },
}) satisfies InventoryBySkuProcedureDefinition<CommercetoolsProcedureContext>;
