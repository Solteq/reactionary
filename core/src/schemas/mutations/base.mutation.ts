import { z } from 'zod';

export const BaseMutationSchema = z.looseInterface({
    query: z.ZodLiteral
});

export type BaseMutation = z.infer<typeof BaseMutationSchema>;