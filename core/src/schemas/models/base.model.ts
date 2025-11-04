import { z } from 'zod';

export const CacheInformationSchema = z.looseObject({
    hit: z.boolean().default(false),
    key: z.string().default('')
})

export const MetaSchema = z.looseObject({
    cache: CacheInformationSchema.default(() => CacheInformationSchema.parse({})),
    placeholder: z.boolean().default(false).describe('Whether or not the entity exists in a remote system, or is a default placeholder.')
});

export const BaseModelSchema = z.looseObject({
    meta: MetaSchema.default(() => MetaSchema.parse({}))
});

export type CacheInformation = z.infer<typeof CacheInformationSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type BaseModel = z.infer<typeof BaseModelSchema>;


export const PaginationOptionsSchema = z.looseObject({
    pageNumber: z.number().default(1).describe('Current page number, starting from 1'),
    pageSize: z.number().min(1).max(50).default(20).describe('Number of items per page'),
});

export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;

/**
 * This seemed like the right way to do it, but we need to be able to pass in the item schema even later than this
 *
 **/
export function createPaginatedResponseSchema<ItemType extends z.ZodTypeAny>(
  itemSchema: ItemType,
) {
  return z.object({
    meta: MetaSchema.default(() => MetaSchema.parse({})),
    pageNumber: z.number().min(1).describe('Current page number, starting from 1'),
    pageSize: z.number().min(1).describe('Number of items per page'),
    totalCount: z.number().min(0).describe('Total number of items available'),
    totalPages: z.number().min(0).describe('Total number of pages available'),
    items: z.array(itemSchema),
  });
}

/**
 * I posit, we should not have final urls in this, but rather assume the frontend has some kind of image transcoding/resizing service it will use to pass the image through, so
 * what we really need is the original source url, and then some metadata about the image.
 * Ie, rather than having distinct thumbnail and image fields, we just have a list of images, and the frontend will generate its own thumbnails as needed?
 */
export const ImageSchema = z.looseObject({
    sourceUrl: z.string().default('').describe('The original source URL of the image. Pass this through your image resizing and transcoding service to get the desired size, and generate thumbnails as needed'),
    altText: z.string().default('').describe('Alternative text for the image, for accessibility purposes. Must always be set, and non-empty'),
    width: z.number().optional().describe('Width of the original image, in pixels, if known'),
    height: z.number().optional().describe('Height of the original image, in pixels, if known'),
});

export type Image = z.infer<typeof ImageSchema>;


