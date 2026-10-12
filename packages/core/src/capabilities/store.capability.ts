import type { NotFoundError } from '../schemas/errors/not-found.error.js';
import type { Store, StorePaginatedResult } from '../schemas/models/store.model.js';
import type {
  StoreQueryById,
  StoreQueryByProximity,
  StoreQueryForList,
} from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import { BaseCapability } from './base.capability.js';

export abstract class StoreCapability<
  TStore extends Store = Store,
  TStorePaginatedResult extends StorePaginatedResult = StorePaginatedResult,
> extends BaseCapability {
  public abstract queryByProximity(payload: StoreQueryByProximity): Promise<Result<Array<TStore>>>;

  /**
   * Lists the brand's own stores, paged.
   *
   * Usecase: You are rendering a store picker for in-store pickup (BOPIS), or a store locator page,
   * and geo coordinates are not available.
   */
  public abstract list(payload: StoreQueryForList): Promise<Result<TStorePaginatedResult>>;

  /**
   * Gets a single store by its identifier.
   *
   * Usecase: You have a store reference on a shipping instruction (in-store pickup / BOPIS) and
   * need to show the store's name, address and opening hours.
   */
  public abstract getById(payload: StoreQueryById): Promise<Result<TStore, NotFoundError>>;

  protected override getResourceName(): string {
    return 'store';
  }
}
