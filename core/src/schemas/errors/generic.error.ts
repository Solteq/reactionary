import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';

export const GenericErrorSchema = z.looseObject({
    type: z.literal('Generic'),
    message: z.string().nonempty()
});

export type GenericError = InferType<typeof GenericErrorSchema>;