import { z } from 'zod';

export const FakeConfigurationSchema = z.interface({
  jitter: z
    .object({
      mean: z.number().min(0).max(10000),
      deviation: z.number().min(0).max(5000),
    })
    .default({
      mean: 0,
      deviation: 0,
    }),
});

export type FakeConfiguration = z.infer<typeof FakeConfigurationSchema>;
