import createDebug from 'debug';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialRequestContext } from '@reactionary/core';
import { RequestContextTokenStore } from '../core/client.js';

const NAMESPACE = 'reactionary:medusa:client';
const previouslyEnabled = createDebug.disable();

afterEach(() => {
  createDebug.disable();
  createDebug.enable(previouslyEnabled);
});

describe('RequestContextTokenStore debug logging', () => {
  it('never writes the stored token value to the debug log', async () => {
    const lines: string[] = [];
    createDebug.enable(NAMESPACE);
    createDebug.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };

    const store = new RequestContextTokenStore(createInitialRequestContext());
    const secret = 'eyJhbGciOiJIUzI1NiJ9.super-secret-jwt-payload.signature';
    await store.setItem('auth_token', secret);
    await store.getItem('auth_token');
    await store.removeItem('auth_token');

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain(secret);
      expect(line).not.toContain('super-secret-jwt-payload');
    }
  });

  it('still stores and returns the token value', async () => {
    const store = new RequestContextTokenStore(createInitialRequestContext());
    await store.setItem('auth_token', 'token-value');

    await expect(store.getItem('auth_token')).resolves.toBe('token-value');

    await store.removeItem('auth_token');
    await expect(store.getItem('auth_token')).resolves.toBeNull();
  });
});
