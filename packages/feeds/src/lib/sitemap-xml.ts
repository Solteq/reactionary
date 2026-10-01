import {
  SitemapIndexStream,
  SitemapStream,
  streamToPromise,
} from 'sitemap';
import type { ReactionarySitemapEntry } from './feed-types.js';

export async function toSitemapXml(
  entries: AsyncIterable<ReactionarySitemapEntry>,
): Promise<string> {
  const sitemap = new SitemapStream();

  for await (const entry of entries) {
    sitemap.write({
      url: entry.url,
      lastmod: entry.lastmod,
      changefreq: entry.changefreq,
      priority: entry.priority,
    });
  }

  sitemap.end();
  return (await streamToPromise(sitemap)).toString();
}

export async function toSitemapIndexXml(
  urls: Iterable<string>,
): Promise<string> {
  const sitemapIndex = new SitemapIndexStream();

  for (const url of urls) {
    sitemapIndex.write({
      url,
    });
  }

  sitemapIndex.end();
  return (await streamToPromise(sitemapIndex)).toString();
}
