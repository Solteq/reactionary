import { z } from 'zod';

export const BaseMutationSchema = z.looseInterface({

});

export type BaseMutation = z.infer<typeof BaseMutationSchema>;