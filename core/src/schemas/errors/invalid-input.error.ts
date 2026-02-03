import { z } from 'zod';
import type { InferType } from '../../zod-utils.js';

export const InvalidInputErrorSchema = z.looseObject({
    type: z.literal('InvalidInput'),
    error: z.string(),
});

export type InvalidInputError = InferType<typeof InvalidInputErrorSchema>;