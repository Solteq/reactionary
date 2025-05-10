import { z } from 'zod';

export const FakeConfigurationSchema = z.interface({
    seed: z.number()
});

export type FakeConfiguration = z.infer<typeof FakeConfigurationSchema>;