import { z } from 'zod';

export const BaseMutationSchema = z.looseObject({
});

export type BaseMutation = z.infer<typeof BaseMutationSchema>;