import { AlgoliaConfiguration, AlgoliaProductProvider } from '@reactionary/provider-algolia';
import { CustomProduct, CustomProductSchema } from '../schemas/custom-product.schema';
import { ProductMutationSchema, ProductQuerySchema } from '@reactionary/core';

export class CustomAlgoliaProductProvider extends AlgoliaProductProvider<CustomProduct> {    
    constructor(config: AlgoliaConfiguration) {
        super(config, CustomProductSchema, ProductQuerySchema, ProductMutationSchema);
      }
    
    public parse(data: any): CustomProduct {
        const result = super.newModel();

        result.gtin = data.ean8 ?? data.ean13 ?? data.partNumber ?? 'missingggg';
        result.name = result.name.toUpperCase();

        return result;
    }
}