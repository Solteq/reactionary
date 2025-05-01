import { AlgoliaConfig, AlgoliaProductProvider } from '@reactionary/provider-algolia';
import { z } from 'zod';

export class CustomAlgoliaProductProvider<T extends z.ZodTypeAny> extends AlgoliaProductProvider<T> {
    constructor(config: AlgoliaConfig, schema: T) {
        super(config, schema);
    }
    
    public override parse(data: any): z.infer<T> {
        const result = super.parse(data);

        // TODO: developer experience sucks here. T needs more information and should be the actual type
        result.gtin = data.ean8 ?? data.ean13 ?? data.partNumber ?? 'missingggg';
        result.name = result.name.toUpperCase();

        return result;
    }
}