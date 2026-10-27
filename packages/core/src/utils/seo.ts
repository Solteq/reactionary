import type { Seo } from '../schemas/models/seo.model.js';

const MAX_DESCRIPTION_LENGTH = 155;

export interface ResolveSeoInput {
  /** The authored SEO data from the entity, if any. */
  seo?: Seo;
  /** Used when no title was authored, typically the entity name (plus store name). */
  fallbackTitle: string;
  /** Used when no description was authored. May contain HTML, it is reduced to plain text. */
  fallbackDescription: string;
  /** Replaces any authored robots directive, e.g. "noindex" when a feature flag hides the page. */
  forcedRobots?: string;
}

export interface ResolvedSeo {
  title: string;
  description: string;
  robots?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const slice = text.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : text.slice(0, maxLength);
  return `${cut.replace(/[\s.,;:!?-]+$/, '')}…`;
}

function authored(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Applies read-time fallbacks to authored SEO data.
 *
 * Providers only map values that were authored, so a missing value means "not authored" and the fallback applies.
 * The description fallback is reduced to plain text and cut at a word boundary, as meta descriptions
 * should be short and free of markup.
 *
 * Pure, it does not read feature flags. Pass `forcedRobots` when a flag decides the robots directive.
 */
export function resolveSeo(input: ResolveSeoInput): ResolvedSeo {
  const title = authored(input.seo?.title) ?? input.fallbackTitle.trim();
  const description =
    authored(input.seo?.description) ??
    truncateAtWord(stripHtml(input.fallbackDescription), MAX_DESCRIPTION_LENGTH);
  const robots = authored(input.forcedRobots) ?? authored(input.seo?.robots);

  return robots === undefined ? { title, description } : { title, description, robots };
}
