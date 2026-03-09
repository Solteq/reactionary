import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';

export const BaseQuerySchema = z.looseObject({
});

export type BaseQuery = InferType<typeof BaseQuerySchema>;