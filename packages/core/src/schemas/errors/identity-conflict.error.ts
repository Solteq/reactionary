import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';

export const IdentityConflictErrorSchema = z.looseObject({
    type: z.literal('IdentityConflict'),
    message: z.string().nonempty(),
});

export type IdentityConflictError = InferType<typeof IdentityConflictErrorSchema>;
