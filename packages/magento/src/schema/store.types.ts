import * as z from 'zod';

/**
 * A Magento MSI in-store pickup location (Magento_InventoryInStorePickupGraphQl
 * `PickupLocation`). The `pickup_location_code` is the MSI source code.
 */
export const MagentoPickupLocationSchema = z.looseObject({
  pickup_location_code: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  contact_name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  street: z.string().nullish(),
  city: z.string().nullish(),
  postcode: z.string().nullish(),
  region: z.string().nullish(),
  country_id: z.string().nullish(),
});

export const MagentoPickupLocationsResponseSchema = z.looseObject({
  pickupLocations: z
    .looseObject({
      items: z.array(MagentoPickupLocationSchema.nullable()).nullish(),
      total_count: z.number().nullish(),
      page_info: z
        .looseObject({
          current_page: z.number().nullish(),
          page_size: z.number().nullish(),
          total_pages: z.number().nullish(),
        })
        .nullish(),
    })
    .nullable(),
});

/** The cache entry holding every pickup location of a store view. */
export const MagentoCachedPickupLocationsSchema = z.looseObject({
  locations: z.array(MagentoPickupLocationSchema),
});

export type MagentoPickupLocation = z.output<typeof MagentoPickupLocationSchema>;
