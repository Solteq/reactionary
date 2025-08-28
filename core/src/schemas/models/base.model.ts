import { z } from 'zod';

export const CacheInformationSchema = z.looseObject({
    hit: z.boolean().default(false).describe('Whether this data was retrieved from cache'),
    key: z.string().default('').describe('The cache key used for this data')
}).describe('Metadata about cache usage for the response')

export const MetaSchema = z.looseObject({
    cache: CacheInformationSchema.default(() => CacheInformationSchema.parse({})).describe('Cache information for this response'),
    placeholder: z.boolean().default(false).describe('Whether or not the entity exists in a remote system, or is a default placeholder.')
}).describe('Metadata about the response and data source');

export const BaseModelSchema = z.looseObject({
    meta: MetaSchema.default(() => MetaSchema.parse({})).describe('Response metadata')
}).describe('Base schema that all models extend from');

export type CacheInformation = z.infer<typeof CacheInformationSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type BaseModel = z.infer<typeof BaseModelSchema>;