import type {
  AnyStoreSchema,
  FulfillmentCenterIdentifier,
  RequestContext,
  Store,
  StoreFactory,
  StoreIdentifier,
  StoreSchema,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoSource } from '../../schema/magento.types.js';

export type { MagentoSource } from '../../schema/magento.types.js';

/**
 * Maps a Magento MSI inventory source onto the core Store model. Storefronts
 * that need address, opening hours or custom `extension_attributes` subclass
 * this with a `StoreSchema.safeExtend(...)` schema, override `parseStore`, and
 * spread `parseSource(data)` into their extended result.
 */
export class MagentoStoreFactory<
  TStoreSchema extends AnyStoreSchema = typeof StoreSchema,
> implements StoreFactory<TStoreSchema>
{
  public readonly storeSchema: TStoreSchema;

  constructor(storeSchema: TStoreSchema) {
    this.storeSchema = storeSchema;
  }

  protected parseSource(data: MagentoSource): Store {
    const identifier = {
      key: data.source_code,
    } satisfies StoreIdentifier;

    const fulfillmentCenter = {
      key: data.source_code,
    } satisfies FulfillmentCenterIdentifier;

    return {
      identifier,
      name: data.name,
      fulfillmentCenter,
    };
  }

  public parseStore(
    _context: RequestContext,
    data: MagentoSource,
  ): z.output<TStoreSchema> {
    return this.storeSchema.parse(this.parseSource(data));
  }
}
