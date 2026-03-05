import type { Channel } from '@commercetools/platform-sdk';
import {
  StoreSchema,
  type AnyStoreSchema,
  type FulfillmentCenterIdentifier,
  type RequestContext,
  type Store,
  type StoreFactory,
  type StoreIdentifier,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsStoreFactory<
  TStoreSchema extends AnyStoreSchema = typeof StoreSchema,
> implements StoreFactory<TStoreSchema>
{
  public readonly storeSchema: TStoreSchema;

  constructor(storeSchema: TStoreSchema) {
    this.storeSchema = storeSchema;
  }

  public parseStore(
    _context: RequestContext,
    data: Channel,
  ): z.output<TStoreSchema> {
    let name = '';
    if (data.name && data.name['la']) {
      name = data.name['la'];
    }

    const identifier = {
      key: data.key || '',
    } satisfies StoreIdentifier;

    const fulfillmentCenter = {
      key: data.key || '',
    } satisfies FulfillmentCenterIdentifier;

    const result = {
      identifier,
      fulfillmentCenter,
      name,
    } satisfies Store;

    return this.storeSchema.parse(result);
  }
}
