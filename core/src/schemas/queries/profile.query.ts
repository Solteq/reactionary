import type * as z from 'zod';
import { BaseQuerySchema } from './base.query.js';
import type { InferType } from '../../zod-utils.js';
import { IdentityIdentifierSchema } from '../models/identifiers.model.js';

export const ProfileQueryByIdSchema = BaseQuerySchema.extend({
  identifier: IdentityIdentifierSchema,
});

export type ProfileQuerySelf = InferType<typeof ProfileQueryByIdSchema>;
