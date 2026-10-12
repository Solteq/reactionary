import type { GenericError } from '../schemas/errors/generic.error.js';
import type { NotFoundError } from '../schemas/errors/not-found.error.js';
import type { Store, StorePaginatedResult } from '../schemas/models/store.model.js';
import type {
  StoreQueryById,
  StoreQueryByProximity,
  StoreQueryForList,
} from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import { error } from '../schemas/result.js';
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
   *
   * The default implementation reports the operation as unsupported, so existing provider
   * implementations remain source-compatible; providers should override it.
   */
  public async list(_payload: StoreQueryForList): Promise<Result<TStorePaginatedResult>> {
    return error<GenericError>({
      type: 'Generic',
      message: `The ${this.getResourceName()} capability of this provider does not support listing stores.`,
    });
  }

  /**
   * Gets a single store by its identifier.
   *
   * Usecase: You have a store reference on a shipping instruction (in-store pickup / BOPIS) and
   * need to show the store's name, address and opening hours.
   *
   * The default implementation reports the operation as unsupported, so existing provider
   * implementations remain source-compatible; providers should override it.
   */
  public async getById(_payload: StoreQueryById): Promise<Result<TStore, NotFoundError>> {
    return error<GenericError>({
      type: 'Generic',
      message: `The ${this.getResourceName()} capability of this provider does not support fetching a store by id.`,
    });
  }

  protected override getResourceName(): string {
    return 'store';
  }
}
