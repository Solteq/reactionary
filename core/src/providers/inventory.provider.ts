import { Inventory } from '../schemas/models/inventory.model';
import { InventoryQuery } from '../schemas/queries/inventory.query';
import { Session } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class InventoryProvider<
  T extends Inventory = Inventory
> extends BaseProvider<T> {
  public abstract getBySKU(payload: InventoryQuery, session: Session): Promise<T>;
}
