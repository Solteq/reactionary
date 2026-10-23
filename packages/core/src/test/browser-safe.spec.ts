import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialRequestContext } from '../initialization.js';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : sourceFiles(path);
    }
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('@reactionary/core in a browser bundle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('has no static import of a node: module, which Storybook and client bundles cannot load', () => {
    const offenders = sourceFiles(join(__dirname, '..')).filter((file) =>
      /(?:from|import)\s*\(?\s*['"]node:/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  it('still drops events emitted from inside a subscriber when the runtime has no AsyncLocalStorage', async () => {
    const original = process.getBuiltinModule;
    Object.defineProperty(process, 'getBuiltinModule', { value: undefined, configurable: true });
    try {
      vi.resetModules();
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { AnalyticsDispatcher, createAnalyticsContext } = await import('../index.js');
      const requestContext = createInitialRequestContext();
      const seen: string[] = [];
      let reentrant: boolean | undefined;
      const holder: { dispatcher?: InstanceType<typeof AnalyticsDispatcher> } = {};
      const dispatcher = new AnalyticsDispatcher({
        requestContext,
        createContext: () => createAnalyticsContext({ capabilities: {}, requestContext }),
        subscribers: [
          {
            name: 'reentrant',
            types: ['product-viewed'],
            purpose: 'necessary',
            async handle() {
              reentrant = holder.dispatcher?.emit('product-clicked', { product: { key: 'loop' } }).success;
            },
          },
          {
            name: 'recorder',
            types: ['*'],
            purpose: 'necessary',
            async handle(event) {
              seen.push(event.type);
            },
          },
        ],
      });
      holder.dispatcher = dispatcher;

      dispatcher.emit('product-viewed', { product: { key: 'p1' } });
      await dispatcher.flush();
      const later = dispatcher.emit('product-clicked', { product: { key: 'p2' } });
      await dispatcher.flush();

      expect(reentrant).toBe(false);
      expect(later.success).toBe(true);
      expect(seen).toEqual(['product-viewed', 'product-clicked']);
    } finally {
      Object.defineProperty(process, 'getBuiltinModule', { value: original, configurable: true, writable: true });
    }
  });
});
