import type { NotFoundError } from '../schemas/index.js';
import type { InventoryIdentifier } from '../schemas/models/identifiers.model.js';
import type { Inventory } from '../schemas/models/inventory.model.js';
import type { InventoryQueryBySKU } from '../schemas/queries/inventory.query.js';
import type { Result } from '../schemas/result.js';
import { BaseProvider } from './base.provider.js';

export abstract class InventoryProvider<TInventory extends Inventory = Inventory> extends BaseProvider {
  public abstract getBySKU(payload: InventoryQueryBySKU): Promise<Result<TInventory, NotFoundError>>;

  protected override getResourceName(): string {
    return 'inventory';
  }

  protected createEmptyInventory(key: InventoryIdentifier): TInventory {
    const inventory = {
        identifier: key,
        quantity: 0,
        status: 'outOfStock'
    } satisfies Inventory;

    return inventory as unknown as TInventory;
  }
}
