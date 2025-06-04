import { z } from 'zod';

export const FakeConfigurationSchema = z.looseInterface({
  jitter: z
    .looseInterface({
      mean: z.number().min(0).max(10000),
      deviation: z.number().min(0).max(5000),
    })
    .default({
      mean: 0,
      deviation: 0,
    }),
});

export type FakeConfiguration = z.infer<typeof FakeConfigurationSchema>;
