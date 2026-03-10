import type { Store } from '../schemas/models/store.model.js';
import type { StoreQueryByProximity } from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import { BaseCapability } from './base.capability.js';

export abstract class StoreCapability<TStore extends Store = Store> extends BaseCapability {
  public abstract queryByProximity(payload: StoreQueryByProximity): Promise<Result<Array<TStore>>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
