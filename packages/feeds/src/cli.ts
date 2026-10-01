#!/usr/bin/env node
import { createInitialRequestContext } from '@reactionary/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDefaultFeedRegistry } from './lib/default-registry.js';
import { ReactionaryFeedGenerator } from './lib/feed-generator.js';
import type { ReactionaryFeedClientFactory, ReactionaryFeedDefinition } from './lib/feed-types.js';

interface FeedsConfig {
  createClient: ReactionaryFeedClientFactory;
  feeds: Record<string, ReactionaryFeedDefinition>;
}

interface CliOptions {
  command: 'list-feeds' | 'list-transformers' | 'generate';
  config: string;
  feed?: string;
  transformer?: string;
  output?: string;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const config = await loadConfig(options.config);
  const registry = createDefaultFeedRegistry();

  if (options.command === 'list-feeds') {
    console.log(JSON.stringify({ feeds: Object.keys(config.feeds) }, null, 2));
    return;
  }

  if (options.command === 'list-transformers') {
    console.log(JSON.stringify({ transformers: registry.list() }, null, 2));
    return;
  }

  if (!options.feed || !options.transformer) {
    throw new Error('generate requires --feed and --transformer');
  }

  const feed = config.feeds[options.feed];
  const transformer = registry.get(options.transformer);

  if (!feed) {
    throw new Error(`Feed not found: ${options.feed}`);
  }

  if (!transformer) {
    throw new Error(`Transformer not found: ${options.transformer}`);
  }

  const requestContext = createInitialRequestContext();
  requestContext.languageContext = feed.languageContext;
  const client = config.createClient(requestContext);
  const generator = new ReactionaryFeedGenerator(client);
  const chunks: Array<string | Uint8Array> = [];

  for await (const chunk of transformer.transform(
    generator.products(feed, requestContext),
    {
      feedId: options.feed,
      feed,
      options: transformer.defaultOptions,
    },
  )) {
    chunks.push(chunk);
  }

  const output = Buffer.concat(chunks.map((chunk) =>
    typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk),
  ));

  if (options.output) {
    await mkdir(dirname(resolve(options.output)), { recursive: true });
    await writeFile(options.output, output);
    return;
  }

  process.stdout.write(output);
}

function parseOptions(args: string[]): CliOptions {
  const [command, ...rest] = args;
  const values = new Map<string, string>();

  if (
    command !== 'list-feeds' &&
    command !== 'list-transformers' &&
    command !== 'generate'
  ) {
    throw new Error('Usage: reactionary-feeds <list-feeds|list-transformers|generate> --config <path>');
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [key, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for argument: ${arg}`);
    }

    values.set(key, value);
    if (inlineValue === undefined) {
      index += 1;
    }
  }

  const config = values.get('config');

  if (!config) {
    throw new Error('--config is required');
  }

  return {
    command,
    config,
    feed: values.get('feed'),
    transformer: values.get('transformer'),
    output: values.get('output'),
  };
}

async function loadConfig(configPath: string): Promise<FeedsConfig> {
  const module = await import(pathToFileURL(resolve(configPath)).href) as {
    default?: FeedsConfig;
  };

  if (!module.default) {
    throw new Error(`Feed config must export a default object: ${configPath}`);
  }

  return module.default;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
