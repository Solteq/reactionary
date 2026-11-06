/**
 * Urls of video players that are meant to be put in an iframe. A watch page (youtube.com/watch, vimeo.com/<id>)
 * cannot be framed, because those hosts refuse it, so such a url is a plain link and not an embed.
 */
const EMBED_URLS: ReadonlyArray<{ provider: string; hosts: readonly string[]; pathPrefix: string }> = [
  { provider: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'], pathPrefix: '/embed/' },
  { provider: 'vimeo', hosts: ['player.vimeo.com'], pathPrefix: '/video/' },
];

/**
 * The provider (`youtube`, `vimeo`) of a url that is an embeddable player, to mark a product asset file as
 * `delivery: 'embed'` with its `embedProvider`. It is `undefined` for any other url, which is a file or a link.
 */
export function detectEmbedProvider(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  return EMBED_URLS.find((entry) => entry.hosts.includes(host) && parsed.pathname.startsWith(entry.pathPrefix))?.provider;
}
