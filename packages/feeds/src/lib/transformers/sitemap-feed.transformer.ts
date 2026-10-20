import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import { toSitemapXml } from '../sitemap-xml.js';

export const sitemapFeedTransformer: ReactionaryFeedTransformer = {
  id: 'sitemap-feed',
  title: 'Sitemap XML Feed',
  description: 'XML sitemap of product URLs.',
  output: {
    contentType: 'application/xml; charset=utf-8',
    fileExtension: 'xml',
  },
  async *transform(products) {
    yield toSitemapXml(toProductSitemapEntries(products));
  },
};

async function *toProductSitemapEntries(
  products: Parameters<ReactionaryFeedTransformer['transform']>[0],
) {
  for await (const product of products) {
    if (!product.url) {
      continue;
    }

    yield {
      url: product.url,
    };
  }
}
