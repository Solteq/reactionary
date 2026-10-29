import type { Seo } from '../schemas/models/seo.model.js';

const MAX_DESCRIPTION_LENGTH = 155;

export interface ResolveSeoInput {
  /** The authored SEO data from the entity, if any. */
  seo?: Seo;
  /** Used when no title was authored, typically the entity name (plus store name). */
  fallbackTitle: string;
  /** Used when no description was authored. May contain HTML, it is reduced to plain text. */
  fallbackDescription: string;
}

export interface ResolvedSeo {
  title: string;
  description: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  // One pass, so "&amp;lt;" becomes the literal text "&lt;" and is not decoded twice.
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    const lower = entity.toLowerCase();
    return lower === 'amp' ? '&' : (NAMED_ENTITIES[lower] ?? match);
  });
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
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
 */
export function resolveSeo(input: ResolveSeoInput): ResolvedSeo {
  const title = authored(input.seo?.title) ?? input.fallbackTitle.trim();
  const description =
    authored(input.seo?.description) ??
    truncateAtWord(stripHtml(input.fallbackDescription), MAX_DESCRIPTION_LENGTH);

  return { title, description };
}
