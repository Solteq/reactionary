import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';

export const NotFoundErrorSchema = z.looseObject({
    type: z.literal('NotFound'),
    identifier: z.unknown()
});

export type NotFoundError = InferType<typeof NotFoundErrorSchema>;