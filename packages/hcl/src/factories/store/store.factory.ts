import type * as z from 'zod';
import type {
  AnyStoreSchema,
  RequestContext,
  Store,
  StoreFactory,
  StoreSchema,
} from '@reactionary/core';
import type { HclPhysicalStore } from '../../schema/hcl.schema.js';

export class HclStoreFactory<
  TStoreSchema extends AnyStoreSchema = typeof StoreSchema,
> implements StoreFactory<TStoreSchema>
{
  public readonly storeSchema: TStoreSchema;

  constructor(storeSchema: TStoreSchema) {
    this.storeSchema = storeSchema;
  }

  public parseStore(
    _context: RequestContext,
    data: HclPhysicalStore,
  ): z.output<TStoreSchema> {
    const name =
      data.Description?.[0]?.displayStoreName ??
      data.storeName ??
      data.uniqueID;

    const result = {
      identifier: { key: data.uniqueID },
      name,
      fulfillmentCenter: { key: data.uniqueID },
    } satisfies Store;

    return this.storeSchema.parse(result);
  }
}
