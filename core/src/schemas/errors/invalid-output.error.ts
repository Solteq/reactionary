import { z } from 'zod';
import type { InferType } from '../../zod-utils.js';

export const InvalidOutputErrorSchema = z.looseObject({
    type: z.literal('InvalidOutput'),
    error: z.string()
});

export type InvalidOutputError = InferType<typeof InvalidOutputErrorSchema>;