import { describe, expect, it } from 'vitest';
import { parseOptions } from './cli.js';

describe('parseOptions', () => {
  it('rejects port strings that contain non-digits', () => {
    expect(() => parseOptions(['--port', '3000oops'], {})).toThrow(
      'Invalid port: 3000oops',
    );
  });

  it('accepts valid CLI port strings', () => {
    expect(parseOptions(['--port', '3000'], {}).port).toBe(3000);
  });
});
