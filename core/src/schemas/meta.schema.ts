import { z } from 'zod';

export const CacheInformationSchema = z.interface({
    hit: z.boolean().default(false),
    key: z.string().default('')
})

export const MetaSchema = z.interface({
    cache: CacheInformationSchema.default(() => CacheInformationSchema.parse({}))
});

export type CacheInformation = z.infer<typeof CacheInformationSchema>;
export type Meta = z.infer<typeof MetaSchema>;