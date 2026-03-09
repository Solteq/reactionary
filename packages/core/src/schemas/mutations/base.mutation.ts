import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';

export const BaseMutationSchema = z.looseObject({
});

export type BaseMutation = InferType<typeof BaseMutationSchema>;