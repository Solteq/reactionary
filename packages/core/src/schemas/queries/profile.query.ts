import type { InferType } from '../../zod-utils.js';
import { IdentityIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from './base.query.js';

export const ProfileQueryByIdSchema = BaseQuerySchema.extend({
  identifier: IdentityIdentifierSchema,
});

export type ProfileQuerySelf = InferType<typeof ProfileQueryByIdSchema>;
