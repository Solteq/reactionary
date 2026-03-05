import type {
  AnyStoreSchema,
  RequestContext,
  StoreFactory,
  StoreSchema,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeStoreFactory<
  TStoreSchema extends AnyStoreSchema = typeof StoreSchema,
> implements StoreFactory<TStoreSchema>
{
  public readonly storeSchema: TStoreSchema;

  constructor(storeSchema: TStoreSchema) {
    this.storeSchema = storeSchema;
  }

  public parseStore(_context: RequestContext, data: unknown): z.output<TStoreSchema> {
    return this.storeSchema.parse(data);
  }
}
