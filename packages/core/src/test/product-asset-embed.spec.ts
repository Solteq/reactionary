import { describe, expect, it } from 'vitest';
import { detectEmbedProvider } from '../utils/product-asset-embed.js';

describe('detectEmbedProvider', () => {
  it('recognises the embeddable player urls', () => {
    expect(detectEmbedProvider('https://www.youtube.com/embed/abc')).toBe('youtube');
    expect(detectEmbedProvider('https://youtube.com/embed/abc?rel=0')).toBe('youtube');
    expect(detectEmbedProvider('https://www.youtube-nocookie.com/embed/abc')).toBe('youtube');
    expect(detectEmbedProvider('https://player.vimeo.com/video/123')).toBe('vimeo');
  });

  it('ignores the host case', () => {
    expect(detectEmbedProvider('https://WWW.YouTube.com/embed/abc')).toBe('youtube');
  });

  it('leaves watch pages, short links and files alone, because they cannot be framed', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=abc',
      'https://youtu.be/abc',
      'https://vimeo.com/123',
      'https://player.vimeo.com/other/123',
      'https://cdn.example.com/embed/video.mp4',
      'https://evil.example.com/youtube.com/embed/abc',
    ]) {
      expect(detectEmbedProvider(url)).toBeUndefined();
    }
  });

  it('gives undefined for something that is not a url', () => {
    expect(detectEmbedProvider('')).toBeUndefined();
    expect(detectEmbedProvider('/media/manual.pdf')).toBeUndefined();
  });
});
