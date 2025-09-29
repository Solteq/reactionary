import { Inventory } from '../schemas/models/inventory.model';
import { InventoryQuery } from '../schemas/queries/inventory.query';
import { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class InventoryProvider<
  T extends Inventory = Inventory
> extends BaseProvider<T> {
  public abstract getBySKU(payload: InventoryQuery, reqCtx: RequestContext): Promise<T>;

  protected override getResourceName(): string {
    return 'inventory';
  }
}
