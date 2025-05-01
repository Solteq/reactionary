import { AlgoliaConfig, AlgoliaProductProvider } from '@reactionary/provider-algolia';
import { z } from 'zod';
import { CustomProduct, CustomProductSchema } from '../schemas/custom-product.schema';

export class CustomAlgoliaProductProvider extends AlgoliaProductProvider<z.ZodType<CustomProduct>> {
    // TODO: Type inference still problematic. The below can be ProductSchema...
    override schema = CustomProductSchema;
    
    constructor(config: AlgoliaConfig) {
        super(config);
    }
    
    public override parse(data: any): CustomProduct {
        const result = super.parse(data);

        result.gtin = data.ean8 ?? data.ean13 ?? data.partNumber ?? 'missingggg';
        result.name = result.name.toUpperCase();

        return result;
    }
}