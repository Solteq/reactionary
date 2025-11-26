import { z } from 'zod';
import { BaseModelSchema } from './base.model.js';
import { FulfillmentCenterIdentifierSchema, StoreIdentifierSchema } from './identifiers.model.js';

export const StoreSchema = BaseModelSchema.extend({
    identifier: StoreIdentifierSchema,
    name: z.string(),
    fulfillmentCenter: FulfillmentCenterIdentifierSchema,
});

export type Store = z.infer<typeof StoreSchema>;
