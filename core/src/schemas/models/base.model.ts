import { z } from 'zod';

export const CacheInformationSchema = z.looseInterface({
    hit: z.boolean().default(false),
    key: z.string().default('')
})

export const MetaSchema = z.looseInterface({
    cache: CacheInformationSchema.default(() => CacheInformationSchema.parse({}))
});

export const BaseModelSchema = z.looseInterface({
    meta: MetaSchema.default(() => MetaSchema.parse({}))
});

export type CacheInformation = z.infer<typeof CacheInformationSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type BaseModel = z.infer<typeof BaseModelSchema>;