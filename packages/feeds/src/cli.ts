#!/usr/bin/env node
import { Command } from 'commander';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import type { RequestContext } from '@reactionary/core';
import { createDefaultFeedRegistry } from './lib/default-registry.js';
import type {
  ReactionaryFeedTransformer,
  ReactionaryFeedTransformerRegistry,
} from './lib/feed-transformer.js';
import { ReactionaryFeedGenerator } from './lib/feed-generator.js';
import type {
  ReactionaryFeedClientFactory,
  ReactionaryFeedDefinition,
  ReactionaryFeedProduct,
  ReactionaryFeedInventoryOptions,
  ReactionaryFeedProcessingOptions,
  ReactionaryFeedProgress,
} from './lib/feed-types.js';

interface FeedsConfig
  extends ReactionaryFeedInventoryOptions,
    ReactionaryFeedProcessingOptions {
  createClient?: ReactionaryFeedClientFactory;
  feeds: Record<string, ReactionaryFeedDefinition>;
}

interface ConfigOptions {
  config: string;
}

interface GenerateOptions extends ConfigOptions {
  output: string[];
  progress?: boolean;
  productConcurrency?: string;
  testMode?: boolean;
}

interface FeedGenerationContext {
  config: FeedsConfig;
  feed: ReactionaryFeedDefinition;
  registry: ReactionaryFeedTransformerRegistry;
  requestContext: RequestContext;
  generator: ReactionaryFeedGenerator;
}

interface OutputSpec {
  transformerId: string;
  outputPath: string;
  transformer: ReactionaryFeedTransformer;
}

async function main(): Promise<void> {
  const program = new Command()
    .name('reactionary-feeds')
    .description('Generate product feeds from Reactionary clients.')
    .version('0.0.1');

  program
    .command('list-feeds')
    .description('List feed ids from a feed config module.')
    .requiredOption('-c, --config <path>', 'Path to an ESM feed config module.')
    .action(async (options: ConfigOptions) => {
      const config = await loadConfig(options.config);
      console.log(JSON.stringify({ feeds: Object.keys(config.feeds) }, null, 2));
    });

  program
    .command('list-transformers')
    .description('List built-in feed output transformers.')
    .requiredOption('-c, --config <path>', 'Path to an ESM feed config module.')
    .action(async (options: ConfigOptions) => {
      await loadConfig(options.config);
      const registry = createDefaultFeedRegistry();
      console.log(JSON.stringify({ transformers: registry.list() }, null, 2));
    });

  program
    .command('generate')
    .description('Generate one or more feed outputs in a single source pass.')
    .requiredOption('-c, --config <path>', 'Path to an ESM feed config module.')
    .requiredOption('-f, --feed <id>', 'Configured feed id to generate.')
    .requiredOption(
      '-o, --output <transformer=path>',
      'Transformer/output pair. Repeat for each output file.',
      collectOption,
      [],
    )
    .option('--product-concurrency <count>', 'Products to normalize in parallel. Defaults to config value or 10.')
    .option('--testMode', 'Limit source reads to at most 2 pages for smoke testing.')
    .option('--no-progress', 'Disable progress reporting on stderr.')
    .action(async (options: GenerateOptions & {
      feed: string;
    }) => {
      await generateFeed(options);
    });

  await program.parseAsync(process.argv);
}

async function generateFeed(
  options: GenerateOptions & {
    feed: string;
  },
): Promise<void> {
  const context = await createFeedGenerationContext(options, {
    feedId: options.feed,
    transformerLabel: 'outputs',
  });
  const outputs = parseOutputSpecs(options.output, context.registry);
  const productOutputs = fanoutAsyncIterable(
    context.generator.products(context.feed, context.requestContext),
    outputs.length,
  );

  await Promise.all(outputs.map((output, index) => {
    const products = productOutputs[index];

    if (!products) {
      throw new Error(`Missing product stream for output: ${output.transformerId}`);
    }

    return writeTransformerOutput({
      feedId: options.feed,
      feed: context.feed,
      output,
      products,
    });
  }));
}

async function createFeedGenerationContext(
  options: GenerateOptions,
  labels: {
    feedId: string;
    transformerLabel: string;
  },
): Promise<FeedGenerationContext> {
  const config = await loadConfig(options.config);
  const registry = createDefaultFeedRegistry();
  const configuredFeed = config.feeds[labels.feedId];

  if (!configuredFeed) {
    throw new Error(`Feed not found: ${labels.feedId}`);
  }

  const feed = options.testMode
    ? withTestModeMaxPages(configuredFeed)
    : configuredFeed;
  const requestContext = createCliRequestContext();
  requestContext.languageContext = feed.languageContext;
  const createClient = await getClientFactory(config);
  const client = createClient(requestContext);
  const progressReporter = options.progress === false
    ? undefined
    : createCliProgressReporter({
        feedId: labels.feedId,
        transformerId: labels.transformerLabel,
        stream: process.stderr,
      });
  const generator = new ReactionaryFeedGenerator(client, {
    defaultFulfillmentCenterKeys: config.defaultFulfillmentCenterKeys,
    productConcurrency: parseProductConcurrency(
      options.productConcurrency,
      config.productConcurrency,
    ),
    onProgress: progressReporter,
  });

  return {
    config,
    feed,
    registry,
    requestContext,
    generator,
  };
}

function withTestModeMaxPages(
  feed: ReactionaryFeedDefinition,
): ReactionaryFeedDefinition {
  return {
    ...feed,
    maxPages: Math.min(feed.maxPages ?? 2, 2),
  };
}

async function writeTransformerOutput(input: {
  feedId: string;
  feed: ReactionaryFeedDefinition;
  output: OutputSpec;
  products: AsyncIterable<ReactionaryFeedProduct>;
}): Promise<void> {
  await mkdir(dirname(resolve(input.output.outputPath)), { recursive: true });

  const stream = createWriteStream(resolve(input.output.outputPath));

  try {
    for await (const chunk of input.output.transformer.transform(
      input.products,
      {
        feedId: input.feedId,
        feed: input.feed,
        options: input.output.transformer.defaultOptions,
      },
    )) {
      if (!stream.write(chunk)) {
        await onceDrain(stream);
      }
    }
  } finally {
    stream.end();
  }

  await finished(stream);
}

function parseOutputSpecs(
  values: string[],
  registry: ReactionaryFeedTransformerRegistry,
): OutputSpec[] {
  if (values.length === 0) {
    throw new Error('At least one --output transformer=path pair is required.');
  }

  const seen = new Set<string>();

  return values.map((value) => {
    const separator = value.indexOf('=');

    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`Invalid --output value "${value}". Expected transformer=path.`);
    }

    const transformerId = value.slice(0, separator);
    const outputPath = value.slice(separator + 1);

    if (seen.has(transformerId)) {
      throw new Error(`Duplicate transformer output: ${transformerId}`);
    }

    seen.add(transformerId);
    const transformer = registry.get(transformerId);

    if (!transformer) {
      throw new Error(`Transformer not found: ${transformerId}`);
    }

    return {
      transformerId,
      outputPath,
      transformer,
    };
  });
}

function fanoutAsyncIterable<T>(
  source: AsyncIterable<T>,
  consumerCount: number,
): Array<AsyncIterable<T>> {
  const maxQueuedItemsPerConsumer = 20;
  const queues = Array.from({ length: consumerCount }, () => [] as T[]);
  const waiters = Array.from({ length: consumerCount }, () => [] as Array<() => void>);
  const capacityWaiters: Array<() => void> = [];
  let done = false;
  let error: unknown = undefined;

  const producer = (async () => {
    try {
      for await (const item of source) {
        while (queues.some((queue) => queue.length >= maxQueuedItemsPerConsumer)) {
          await new Promise<void>((resolve) => {
            capacityWaiters.push(resolve);
          });
        }

        for (const queue of queues) {
          queue.push(item);
        }

        for (const queueWaiters of waiters) {
          queueWaiters.splice(0).forEach((wake) => wake());
        }
      }
    } catch (caught) {
      error = caught;
    } finally {
      done = true;

      for (const queueWaiters of waiters) {
        queueWaiters.splice(0).forEach((wake) => wake());
      }
    }
  })();

  return queues.map((queue, index) => ({
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length > 0) {
          const item = queue.shift() as T;
          capacityWaiters.splice(0).forEach((wake) => wake());
          yield item;
          continue;
        }

        if (done) {
          if (error) {
            throw error;
          }

          await producer;
          return;
        }

        await new Promise<void>((resolve) => {
          waiters[index].push(resolve);
        });
      }
    },
  }));
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function onceDrain(stream: NodeJS.WritableStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.once('drain', resolve);
    stream.once('error', reject);
  });
}

async function getClientFactory(
  config: FeedsConfig,
): Promise<ReactionaryFeedClientFactory> {
  if (config.createClient) {
    return config.createClient;
  }

  const {
    createReactionaryFeedClientFactoryFromEnv,
  } = await import('./lib/env-client-builder.js');

  return createReactionaryFeedClientFactoryFromEnv();
}

function createCliRequestContext(): RequestContext {
  return {
    languageContext: {
      locale: 'da-DK',
      currencyCode: 'DKK',
    },
    storeIdentifier: {
      key: 'the-good-store',
    },
    taxJurisdiction: {
      countryCode: 'DK',
      stateCode: '',
      countyCode: '',
      cityCode: '',
    },
    session: {
      identityContext: {
        identity: {
          type: 'Anonymous',
        },
        lastUpdated: new Date(),
      },
      marketingContext: {
        identifier: { key: '' },
        segments: [],
        blurb: '',
      },
    },
    correlationId: '',
    isBot: false,
    clientIp: '',
    userAgent: '',
    referrer: '',
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

function createCliProgressReporter(options: {
  feedId: string;
  transformerId: string;
  stream: NodeJS.WriteStream;
}): (progress: ReactionaryFeedProgress) => void {
  const label = `${options.feedId}/${options.transformerId}`;
  const throttleMs = options.stream.isTTY ? 100 : 5_000;
  let lastRenderedAt = 0;
  let lastLength = 0;

  return (progress) => {
    const now = Date.now();
    const completed = progress.phase === 'completed';

    if (!completed && now - lastRenderedAt < throttleMs) {
      return;
    }

    const line = formatProgressLine(label, progress);

    if (options.stream.isTTY) {
      options.stream.write(`\r${line.padEnd(lastLength)}`);
      lastLength = line.length;

      if (completed) {
        options.stream.write('\n');
      }
    } else {
      options.stream.write(`${line}\n`);
    }

    lastRenderedAt = now;
  };
}

function formatProgressLine(
  label: string,
  progress: ReactionaryFeedProgress,
): string {
  const total = progress.totalProducts;
  const processed = progress.processedProducts;
  const percent = total === undefined
    ? undefined
    : total === 0
      ? 1
      : Math.min(processed / total, 1);
  const count = total === undefined ? `${processed}/?` : `${processed}/${total}`;
  const page = progress.pageNumber && progress.totalPages
    ? ` page ${progress.pageNumber}/${progress.totalPages}`
    : '';
  const status = progress.phase === 'completed' ? 'done' : progress.phase;
  const eta = progress.phase === 'completed'
    ? '0s'
    : formatEta(progress, percent);

  return [
    `${label}`,
    formatProgressBar(percent),
    count,
    percent === undefined ? '' : `${Math.round(percent * 100)}%`,
    status,
    page.trim(),
    `elapsed ${formatDuration(progress.elapsedMs)}`,
    `eta ${eta}`,
  ].filter(Boolean).join(' ');
}

function formatProgressBar(percent: number | undefined): string {
  const width = 24;

  if (percent === undefined) {
    return `[${'?'.repeat(width)}]`;
  }

  const completed = Math.round(percent * width);
  return `[${'#'.repeat(completed)}${'-'.repeat(width - completed)}]`;
}

function formatEta(
  progress: ReactionaryFeedProgress,
  percent: number | undefined,
): string {
  if (
    percent === undefined ||
    progress.totalProducts === undefined ||
    progress.processedProducts === 0
  ) {
    return 'estimating';
  }

  const remainingProducts = Math.max(
    progress.totalProducts - progress.processedProducts,
    0,
  );
  const msPerProduct = progress.elapsedMs / progress.processedProducts;
  return formatDuration(msPerProduct * remainingProducts);
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function parseProductConcurrency(
  value: string | undefined,
  fallback: number | undefined,
): number | undefined {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`--product-concurrency must be a positive number, got: ${value}`);
  }

  return Math.floor(parsed);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
