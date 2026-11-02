import { SearchFacetPolicyOptionsSchema } from '@reactionary/core';
import * as z from 'zod';

export const AlgoliaConfigurationSchema = z.looseObject({
    appId: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
    facets: SearchFacetPolicyOptionsSchema.optional().meta({ description: 'Facets to hide and facet names, on top of the defaults: flags and conceptIds are always hidden, productType.name is named "Product type" and concepts.<vocabulary> after the vocabulary.' }),
    ruleContextSegments: z.array(z.string()).optional().meta({ description: 'Which segments of a visitor are sent to Algolia as rule contexts (`segment_<name>`), as patterns where `*` stands for any characters, for example `["vip", "campaign-*"]`. Without it every segment but the affinity segments is sent, alphabetically and at most 10. With it only the segments that match are, and an empty list sends none. Affinity segments never are: they rank products through `optionalFilters`.' }),
    useBaseIndexNameForEnglishLocale: z.boolean().default(false).meta({ description: 'Deprecated. Whether to use the base index name, without locale suffix, for the English locale. By default, this is disabled and every locale, including English, uses an index with a locale suffix (e.g. products_en), which is what recalcitrant writes. Enable only for legacy setups with an unsuffixed English index.', deprecated: true })
});

export type AlgoliaConfiguration = z.infer<typeof AlgoliaConfigurationSchema>;
