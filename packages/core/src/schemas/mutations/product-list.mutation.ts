import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { ImageSchema } from '../models/base.model.js';
import { CompanyIdentifierSchema, ProductListIdentifierSchema, ProductListItemIdentifierSchema } from '../models/identifiers.model.js';
import { ProductListItemSchema, ProductListSchema } from '../models/product-list.model.js';
import { BaseMutationSchema } from './base.mutation.js';

export const ProductListCreateSchema = ProductListSchema.omit({ identifier: true });

export const ProductListMutationCreateSchema = BaseMutationSchema.extend({
    list: ProductListCreateSchema.describe('The details of the product list to create, including its name, description, type, and any associated image.'),
    company: CompanyIdentifierSchema.optional().describe('The identifier for the company to create the product list within. This can be used to associate the list with a specific company, which can be useful for B2B use cases. If not provided, the list will be created in a default or global context.'),
});

export const ProductListMutationDeleteSchema = BaseMutationSchema.extend({
    list: ProductListIdentifierSchema.meta({ description: 'The identifier for the product list to delete.' }),
});

export const ProductListMutationUpdateSchema = BaseMutationSchema.extend({
    list: ProductListIdentifierSchema.meta({ description: 'The identifier for the product list to update.' }),
    name: z.string().optional().meta({ description: 'The name of the product list.' }),
    description: z.string().optional().meta({ description: 'A description of the product list. A longer text providing more details about the list.' }),
    image: ImageSchema.optional().describe('Icon or image associated with list '),
    published: z.boolean().optional().meta({ description: 'Whether the wish list is published and visible to others. Semantics may vary. ' }),
    publishDate: z.string().optional().meta({ description: 'The date at which a list is published for others to see. Sematics may vary' }),
});



export const ProductListItemCreateSchema = ProductListItemSchema.omit({ identifier: true });
export const ProductListItemMutationCreateSchema = BaseMutationSchema.extend({
    list: ProductListIdentifierSchema.describe('The identifier for the product list to add an item to.'),
    listItem: ProductListItemCreateSchema.describe('The details of the item to add to the list, including the product variant identifier, quantity, and any notes about the item.'),
});

export const ProductListItemMutationDeleteSchema = BaseMutationSchema.extend({
    listItem: ProductListItemIdentifierSchema.describe('The identifier for the product list item to remove. The list items identifier contains a reference to the list itself'),
});

export const ProductListItemMutationUpdateSchema = BaseMutationSchema.extend({
    listItem: ProductListItemIdentifierSchema.describe('The identifier for the product list item to update. The list items identifier contains a reference to the list itself'),
    quantity: z.number().positive().optional().meta({ description: 'The updated quantity of the product variant that is included in the list.' }),
    notes: z.string().optional().meta({ description: 'Updated additional notes or comments about the product variant in the list.' }),
    order: z.number().optional().meta({ description: 'The updated order of the item in the list. This can be used to sort the items in the list.' }),
});

export type ProductListItemCreate = InferType<typeof ProductListItemCreateSchema>;
export type ProductListItemMutationCreate = InferType<typeof ProductListItemMutationCreateSchema>;
export type ProductListItemMutationDelete = InferType<typeof ProductListItemMutationDeleteSchema>;
export type ProductListItemMutationUpdate = InferType<typeof ProductListItemMutationUpdateSchema>;
export type ProductListCreate = InferType<typeof ProductListCreateSchema>;
export type ProductListMutationCreate = InferType<typeof ProductListMutationCreateSchema>;
export type ProductListMutationUpdate = InferType<typeof ProductListMutationUpdateSchema>;
export type ProductListMutationDelete = InferType<typeof ProductListMutationDeleteSchema>;

