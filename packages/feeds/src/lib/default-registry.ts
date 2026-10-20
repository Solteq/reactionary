import {
  ReactionaryFeedTransformerRegistry,
} from './feed-transformer.js';
import { acpFeedMetadataTransformer, acpProductFeedTransformer } from './transformers/acp-product-feed.transformer.js';
import { googleMerchantFeedTransformer } from './transformers/google-merchant-feed.transformer.js';
import { pricerunnerFeedTransformer } from './transformers/pricerunner-feed.transformer.js';
import { sitemapFeedTransformer } from './transformers/sitemap-feed.transformer.js';

export function createDefaultFeedRegistry(): ReactionaryFeedTransformerRegistry {
  const registry = new ReactionaryFeedTransformerRegistry();
  registry.register(acpProductFeedTransformer);
  registry.register(acpFeedMetadataTransformer);
  registry.register(googleMerchantFeedTransformer);
  registry.register(sitemapFeedTransformer);
  registry.register(pricerunnerFeedTransformer);
  return registry;
}
