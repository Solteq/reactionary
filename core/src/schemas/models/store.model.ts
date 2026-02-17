import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import {
  FulfillmentCenterIdentifierSchema,
  StoreIdentifierSchema,
} from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const StoreSchema = BaseModelSchema.extend({
  identifier: StoreIdentifierSchema,
  name: z.string(),
  fulfillmentCenter: FulfillmentCenterIdentifierSchema,
});

export type Store = InferType<typeof StoreSchema>;