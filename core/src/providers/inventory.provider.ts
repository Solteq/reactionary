import type { InventoryIdentifier } from '../schemas/models/identifiers.model.js';
import type { Inventory } from '../schemas/models/inventory.model.js';
import type { InventoryQueryBySKU } from '../schemas/queries/inventory.query.js';
import { BaseProvider } from './base.provider.js';

export abstract class InventoryProvider extends BaseProvider {
  public abstract getBySKU(payload: InventoryQueryBySKU): Promise<Inventory>;

  protected override getResourceName(): string {
    return 'inventory';
  }

  protected createEmptyInventory(key: InventoryIdentifier): Inventory {
    const inventory = {
        identifier: key,
        quantity: 0,
        status: 'outOfStock',
        meta: {
          cache: {
            hit: false,
            key: this.generateCacheKeySingle(key),
          },
          placeholder: true,
        }
    } satisfies Inventory;

    return inventory;
  }
}
