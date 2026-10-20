import type { AdminStockLocation } from '@medusajs/types';
import type {
  Address,
  AnyStoreSchema,
  FulfillmentCenterIdentifier,
  RequestContext,
  Store,
  StoreFactory,
  StoreIdentifier,
  StoreSchema,
} from '@reactionary/core';
import { AddressIdentifierSchema } from '@reactionary/core';
import type * as z from 'zod';

export class MedusaStoreFactory<
  TStoreSchema extends AnyStoreSchema = typeof StoreSchema,
> implements StoreFactory<TStoreSchema>
{
  public readonly storeSchema: TStoreSchema;

  constructor(storeSchema: TStoreSchema) {
    this.storeSchema = storeSchema;
  }

  /**
   * Extension point to control the parsing of the stock location address
   * into the store's address.
   */
  protected parseAddress(
    _context: RequestContext,
    data: AdminStockLocation,
  ): Address | undefined {
    if (!data.address) {
      return undefined;
    }

    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: data.address.id,
      }),
      firstName: '',
      lastName: data.address.company || data.name,
      streetAddress: data.address.address_1 || '',
      streetNumber: data.address.address_2 || '',
      city: data.address.city || '',
      region: data.address.province || '',
      postalCode: data.address.postal_code || '',
      countryCode: data.address.country_code || '',
    } satisfies Address;
  }

  public parseStore(
    context: RequestContext,
    data: AdminStockLocation,
  ): z.output<TStoreSchema> {
    const identifier = {
      key: data.id,
    } satisfies StoreIdentifier;

    // Fulfillment centers are referenced by stock-location name elsewhere in
    // this provider (see the inventory capability), so link by name here too.
    const fulfillmentCenter = {
      key: data.name,
    } satisfies FulfillmentCenterIdentifier;

    const openingHours =
      data.metadata?.['opening_hours'] != null
        ? String(data.metadata['opening_hours'])
        : undefined;

    const result = {
      identifier,
      name: data.name,
      fulfillmentCenter,
      address: this.parseAddress(context, data),
      openingHours,
    } satisfies Store;

    return this.storeSchema.parse(result);
  }
}
