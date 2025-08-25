import { z } from 'zod';
import { ProductIdentifierSchema, SKUIdentifierSchema } from './identifiers.model';
import { BaseModelSchema } from './base.model';

export const ImageSchema = z.looseInterface({
    url: z.string().url().default('https://placehold.co/400x400'),
    title: z.string().default('Placeholder image'),
    height: z.number().default(400),
    width: z.number().default(400)
});

export const SelectionAttributeSchema = z.looseInterface({
    id: z.string(),
    name: z.string(),
    value: z.string()
});

export const TechnicalSpecificationSchema = z.looseInterface({
    id: z.string(),
    name: z.string(),
    value: z.string()
});

export const SKUSchema = z.looseInterface({
    identifier: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
    image: ImageSchema.default(() => ImageSchema.parse({})),
    images: z.array(ImageSchema).default(() => []),
    selectionAttributes: z.array(SelectionAttributeSchema).default(() => []),
    technicalSpecifications: z.array(TechnicalSpecificationSchema).default(() => []),
    isHero: z.boolean().default(false)
});

export const ProductSchema = BaseModelSchema.extend({
    identifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
    name: z.string().default(''),
    slug: z.string().default(''),
    description: z.string().default(''),
    skus: z.array(SKUSchema).default(() => [])
});

export type Image = z.infer<typeof ImageSchema>;
export type SKU = z.infer<typeof SKUSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type SelectionAttribute = z.infer<typeof SelectionAttributeSchema>;
export type TechnicalSpecification = z.infer<typeof TechnicalSpecificationSchema>;
