import { z } from 'zod';

export const BaseMutationSchema = z.looseInterface({
    mutation: z.ZodLiteral
});

export type BaseMutation = z.infer<typeof BaseMutationSchema>;