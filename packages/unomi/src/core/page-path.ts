/**
 * The path of a page as the `pagePath` of the Unomi page item: no host, query or fragment, and no trailing slash, so `/campaign/springtime/`
 * and `/campaign/springtime` are the same page and a condition on the path does not have to cover both. The root stays `/`. The language
 * prefix is kept: the slugs of a storefront are localized, so the paths of two languages are not the same page.
 */
export function pagePathOf(url: string): string {
  let path = url;
  try {
    path = new URL(url, 'https://placeholder.invalid').pathname;
  } catch {
    // keep the url as the path
  }
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}
