import { z } from 'zod';

export const BaseMutationSchema = z.looseObject({
    mutation: z.ZodLiteral
});

export type BaseMutation = z.infer<typeof BaseMutationSchema>;