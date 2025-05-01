import { AlgoliaConfig, AlgoliaProductProvider } from '@reactionary/provider-algolia';
import { z } from 'zod';
import { CustomProduct } from '../schemas/custom-product.schema';
import { Product, ProductSchema } from '@reactionary/core';

export class CustomAlgoliaProductProvider extends AlgoliaProductProvider<z.ZodType<CustomProduct>> {
    override schema = ProductSchema;
    
    constructor(config: AlgoliaConfig) {
        super(config);
        
        
    }
    
    public override parse(data: any): CustomProduct {
        const result = super.parse(data);

        // TODO: developer experience sucks here. T needs more information and should be the actual type
        result.gtin = data.ean8 ?? data.ean13 ?? data.partNumber ?? 'missingggg';
        result.name = result.name.toUpperCase();

        return result;
    }
}