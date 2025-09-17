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
  seeds: z.looseInterface({
    product: z.number().min(0).max(10000).default(1),
    search: z.number().min(0).max(10000).default(1),
    category: z.number().min(0).max(10000).default(1),
  }),
});

export type FakeConfiguration = z.infer<typeof FakeConfigurationSchema>;
