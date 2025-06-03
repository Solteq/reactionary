import { AlgoliaConfiguration, AlgoliaProductProvider } from '@reactionary/provider-algolia';
import { CustomProduct, CustomProductSchema } from '../schemas/custom-product.schema';

export class CustomAlgoliaProductProvider extends AlgoliaProductProvider<CustomProduct> {    
    constructor(config: AlgoliaConfiguration) {
        super(config, CustomProductSchema);
      }
    
    public override parse(data: any): CustomProduct {
        const result = super.parse(data);

        result.gtin = data.ean8 ?? data.ean13 ?? data.partNumber ?? 'missingggg';
        result.name = result.name.toUpperCase();

        return result;
    }
}