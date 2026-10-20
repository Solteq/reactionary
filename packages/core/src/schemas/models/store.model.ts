import * as z from 'zod';
import { BaseModelSchema, createPaginatedResponseSchema } from './base.model.js';
import {
  FulfillmentCenterIdentifierSchema,
  StoreIdentifierSchema,
} from './identifiers.model.js';
import { AddressSchema } from './profile.model.js';
import type { InferType } from '../../zod-utils.js';

export const StoreSchema = BaseModelSchema.extend({
  identifier: StoreIdentifierSchema,
  name: z.string(),
  fulfillmentCenter: FulfillmentCenterIdentifierSchema,
  address: AddressSchema.optional().meta({ description: 'The physical address of the store, if known. Useful for showing the store on a map, and as the shipping address for in-store pickup (BOPIS).' }),
  openingHours: z.string().optional().meta({ description: 'The opening hours of the store, if known. This could be a string like "Mon-Fri 9am-5pm".' }),
});

export const StorePaginatedResultSchema = createPaginatedResponseSchema(StoreSchema);

export type Store = InferType<typeof StoreSchema>;
export type StorePaginatedResult = InferType<typeof StorePaginatedResultSchema>;
