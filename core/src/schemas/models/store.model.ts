import { z } from 'zod';
import { BaseModelSchema } from './base.model.js';
import { FulfillmentCenterIdentifierSchema, StoreIdentifierSchema } from './identifiers.model.js';

export const StoreSchema = BaseModelSchema.extend({
    identifier: StoreIdentifierSchema.default(() => StoreIdentifierSchema.parse({})),
    name: z.string().default(''),
    fulfillmentCenter: FulfillmentCenterIdentifierSchema.default(() => FulfillmentCenterIdentifierSchema.parse({}))
});

export type Store = z.infer<typeof StoreSchema>;
