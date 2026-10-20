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
import type { MagentoPickupLocation } from '../../schema/store.types.js';

/**
 * Maps MSI in-store pickup locations onto core stores. The pickup location
 * code is both the store key and the fulfillment center key, since it is the
 * MSI source code the inventory capability reports stock against. Magento has
 * no opening hours on pickup locations, so `openingHours` stays undefined.
 */
export class MagentoStoreFactory<
  TStoreSchema extends AnyStoreSchema = typeof StoreSchema,
> implements StoreFactory<TStoreSchema>
{
  public readonly storeSchema: TStoreSchema;

  constructor(storeSchema: TStoreSchema) {
    this.storeSchema = storeSchema;
  }

  /** Extension point for mapping the pickup location's address. */
  protected parseAddress(
    _context: RequestContext,
    data: MagentoPickupLocation,
  ): Address | undefined {
    if (!data.street && !data.city && !data.postcode && !data.country_id) {
      return undefined;
    }

    return {
      identifier: AddressIdentifierSchema.parse({ nickName: data.pickup_location_code }),
      firstName: '',
      lastName: data.contact_name || data.name || '',
      streetAddress: data.street || '',
      streetNumber: '',
      city: data.city || '',
      region: data.region || '',
      postalCode: data.postcode || '',
      countryCode: data.country_id || '',
    } satisfies Address;
  }

  public parseStore(context: RequestContext, data: MagentoPickupLocation): z.output<TStoreSchema> {
    const identifier = { key: data.pickup_location_code } satisfies StoreIdentifier;
    const fulfillmentCenter = { key: data.pickup_location_code } satisfies FulfillmentCenterIdentifier;

    const result = {
      identifier,
      name: data.name || data.pickup_location_code,
      fulfillmentCenter,
      address: this.parseAddress(context, data),
    } satisfies Store;

    return this.storeSchema.parse(result);
  }
}
