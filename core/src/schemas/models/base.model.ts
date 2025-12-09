import { z } from 'zod';
import type { InferType } from '../../zod-utils.js';

export const BaseModelSchema = z.looseObject({
});

export const PaginationOptionsSchema = z.looseObject({
    pageNumber: z.number().default(1).describe('Current page number, starting from 1'),
    pageSize: z.number().min(1).max(50).default(20).describe('Number of items per page'),
});

/**
 * This seemed like the right way to do it, but we need to be able to pass in the item schema even later than this
 *
 **/
export function createPaginatedResponseSchema<ItemType extends z.ZodTypeAny>(
  itemSchema: ItemType,
) {
  return z.object({
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

export type Image = InferType<typeof ImageSchema>;
export type PaginationOptions = InferType<typeof PaginationOptionsSchema>;
export type BaseModel = InferType<typeof BaseModelSchema>;
