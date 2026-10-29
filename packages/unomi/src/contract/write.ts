import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  generateExamples,
  generateManifest,
  generateSchemas,
  type GeneratedFile,
  type JsonObject,
} from './json-schema.js';

export const MANIFEST_FILE = 'contract.manifest.json';

export interface WriteOptions {
  /** Where `items/` and `events/` go, and the manifest. */
  readonly out: string;
  /** When set, one example event per event type is written here. */
  readonly examplesDir?: string;
  readonly schemaVersion?: string;
  readonly reactionaryVersion?: string;
  readonly scope?: string;
}

export interface WriteResult {
  readonly written: string[];
  readonly removed: string[];
}

function json(document: JsonObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function write(root: string, file: GeneratedFile, written: string[]): void {
  const target = join(root, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, json(file.document));
  written.push(target);
}

function previousNames(manifestPath: string): { items: string[]; events: string[] } {
  if (!existsSync(manifestPath)) {
    return { items: [], events: [] };
  }
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const manifest = typeof parsed === 'object' && parsed !== null ? parsed : {};
  const items = 'items' in manifest && Array.isArray(manifest.items) ? manifest.items.filter((n): n is string => typeof n === 'string') : [];
  const events = 'events' in manifest && Array.isArray(manifest.events)
    ? manifest.events.flatMap((e: unknown) => (typeof e === 'object' && e !== null && 'name' in e && typeof e.name === 'string' ? [e.name] : []))
    : [];
  return { items, events };
}

/**
 * Writes the contract as files. Directories this generator wrote earlier (named in the previous manifest) are removed first,
 * so a retired event does not linger. Anything else in `out` is left alone.
 */
export function writeContract(options: WriteOptions): WriteResult {
  const written: string[] = [];
  const removed: string[] = [];
  const manifestPath = join(options.out, MANIFEST_FILE);

  const previous = previousNames(manifestPath);
  for (const [kind, names] of [['items', previous.items], ['events', previous.events]] as const) {
    for (const name of names) {
      const dir = join(options.out, kind, name);
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        removed.push(dir);
      }
    }
  }

  for (const file of generateSchemas({ schemaVersion: options.schemaVersion })) {
    write(options.out, file, written);
  }

  const manifestDir = dirname(manifestPath);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(manifestPath, json(generateManifest({ schemaVersion: options.schemaVersion, reactionaryVersion: options.reactionaryVersion })));
  written.push(manifestPath);

  if (options.examplesDir) {
    for (const file of generateExamples({ scope: options.scope })) {
      write(options.examplesDir, file, written);
    }
  }

  return { written, removed };
}
