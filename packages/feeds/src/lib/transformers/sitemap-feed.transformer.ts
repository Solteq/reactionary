import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import { escapeXml } from './shared.js';

export const sitemapFeedTransformer: ReactionaryFeedTransformer = {
  id: 'sitemap-feed',
  title: 'Sitemap XML Feed',
  description: 'XML sitemap of product URLs.',
  output: {
    contentType: 'application/xml; charset=utf-8',
    fileExtension: 'xml',
  },
  async *transform(products) {
    yield '<?xml version="1.0" encoding="UTF-8"?>\n';
    yield '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for await (const product of products) {
      if (!product.url) {
        continue;
      }

      yield `  <url><loc>${escapeXml(product.url)}</loc></url>\n`;
    }

    yield '</urlset>\n';
  },
};
