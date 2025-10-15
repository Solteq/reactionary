import type { Inventory } from '../schemas/models/inventory.model.js';
import type { InventoryQueryBySKU } from '../schemas/queries/inventory.query.js';
import type { RequestContext } from '../schemas/session.schema.js';
import { BaseProvider } from './base.provider.js';

export abstract class InventoryProvider<
  T extends Inventory = Inventory
> extends BaseProvider<T> {
  public abstract getBySKU(payload: InventoryQueryBySKU, reqCtx: RequestContext): Promise<T>;

  protected override getResourceName(): string {
    return 'inventory';
  }
}
