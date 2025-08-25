import { Inventory } from '../schemas/models/inventory.model';
import { InventoryQuery } from '../schemas/queries/inventory.query';
import { InventoryMutation } from '../schemas/mutations/inventory.mutation';
import { BaseProvider } from './base.provider';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';

export abstract class InventoryProvider<
  T extends Inventory = Inventory,
  Q extends InventoryQuery = InventoryQuery,
  M extends InventoryMutation = InventoryMutation
> extends BaseProvider<T, Q, M> {
  
  protected override getCacheEvaluation(query: Q, _session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    const key = `${providerName}:inventory:${query.sku}`;
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }
}
