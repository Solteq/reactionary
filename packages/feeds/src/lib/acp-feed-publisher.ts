import { createInitialRequestContext } from '@reactionary/core';
import { ReactionaryFeedGenerator } from './feed-generator.js';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedClientFactory,
  ReactionaryFeedDefinition,
  ReactionaryFeedInventoryOptions,
  ReactionaryFeedProcessingOptions,
  ReactionaryFeedProgress,
} from './feed-types.js';
import {
  toACPFeedProduct,
  type ACPFeedMetadata,
  type ACPFeedProduct,
} from './transformers/acp-product-feed.transformer.js';
import * as z from 'zod';

const ACP_FEED_API_VERSION = '2026-04-17';
/** The environment variable holding the Feed API key, unless configured otherwise. */
export const DEFAULT_ACP_FEED_API_KEY_ENV = 'ACP_FEED_API_KEY';
const DEFAULT_BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

export interface ReactionaryACPFeedPublisherOptions
  extends ReactionaryFeedInventoryOptions,
    ReactionaryFeedProcessingOptions {
  /** Base URL of the agent's Feed API, e.g. `https://agent.example/api`. */
  feedApiBaseUrl: string;
  /** The bearer token the agent issued to this merchant. */
  apiKey: string;
  /** Feed definitions by key: what to search, in which language context. */
  feeds: Record<string, ReactionaryFeedDefinition>;
  /** Products per `PATCH /feeds/{id}/products` request. Defaults to 100. */
  batchSize?: number;
  /** Fetch implementation; defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Generation progress, e.g. for a CLI progress line. */
  onProgress?: (progress: ReactionaryFeedProgress) => void;
}

export interface ACPFeedPublishResult {
  feedId: string;
  products: number;
  batches: number;
}

const ACPFeedMetadataSchema = z.looseObject({
  id: z.string(),
  target_country: z.string().optional(),
  updated_at: z.string().optional(),
});

const ACPFeedUpsertResponseSchema = z.looseObject({
  id: z.string().optional(),
  accepted: z.boolean(),
});

/**
 * Publishes product feeds to an agent's Feed API (ACP 2026-04-17). Feeds are
 * agent-hosted and pushed by merchants: create the feed once, then upsert
 * its products. For file ingestion instead, generate `products.jsonl` and
 * `metadata.json` with the `@reactionary/feeds` CLI (`acp-product-feed`,
 * `acp-feed-metadata`).
 */
export class ReactionaryACPFeedPublisher<
  TClient extends ReactionaryFeedClient = ReactionaryFeedClient,
> {
  private readonly fetchImpl: typeof fetch;

  public constructor(
    private readonly clientFactory: ReactionaryFeedClientFactory<TClient>,
    private readonly options: ReactionaryACPFeedPublisherOptions,
  ) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  /** `POST /feeds`: creates a feed on the agent for the definition's market. */
  public async createFeed(feedKey: string): Promise<ACPFeedMetadata> {
    const feed = this.getFeed(feedKey);
    const [, region] = feed.languageContext.locale.split('-');
    const response = await this.request('POST', '/feeds', region ? { target_country: region.toUpperCase() } : {});

    return ACPFeedMetadataSchema.parse(response);
  }

  /** `GET /feeds/{id}`: the agent's metadata for a feed. */
  public async getFeedMetadata(feedId: string): Promise<ACPFeedMetadata> {
    return ACPFeedMetadataSchema.parse(await this.request('GET', `/feeds/${encodeURIComponent(feedId)}`));
  }

  /**
   * Generates the feed's products and upserts them, in batches, into the
   * agent-hosted feed with `PATCH /feeds/{feedId}/products`. The feed id
   * defaults to the definition's `acp.feedId`, as handed out by the agent's
   * onboarding. Upserts never remove products; to drop products, replace
   * the feed by file ingestion.
   */
  public async publish(feedKey: string, feedId?: string): Promise<ACPFeedPublishResult> {
    const feed = this.getFeed(feedKey);
    const targetFeedId = feedId ?? feed.acp?.feedId;

    if (!targetFeedId) {
      throw new Error(`ACP feed ${feedKey} has no feed id; configure acp.feedId (from the agent's onboarding) or create one with create-acp-feed.`);
    }

    const requestContext = createInitialRequestContext();
    requestContext.languageContext = feed.languageContext;

    const generator = new ReactionaryFeedGenerator(this.clientFactory(requestContext), {
      defaultFulfillmentCenterKeys: this.options.defaultFulfillmentCenterKeys,
      productConcurrency: this.options.productConcurrency,
      onProgress: this.options.onProgress,
    });
    const batchSize = Math.max(this.options.batchSize ?? DEFAULT_BATCH_SIZE, 1);
    const path = `/feeds/${encodeURIComponent(targetFeedId)}/products`;
    let batch: ACPFeedProduct[] = [];
    let products = 0;
    let batches = 0;

    const flush = async () => {
      if (batch.length === 0) {
        return;
      }

      const response = ACPFeedUpsertResponseSchema.parse(await this.request('PATCH', path, { products: batch }));

      if (!response.accepted) {
        throw new Error(`ACP feed ${targetFeedId}: the agent did not accept the product upsert.`);
      }

      products += batch.length;
      batches += 1;
      batch = [];
    };

    for await (const product of generator.products(feed, requestContext)) {
      const acpProduct = toACPFeedProduct(product, feed);

      if (acpProduct) {
        batch.push(acpProduct);
      }

      if (batch.length >= batchSize) {
        await flush();
      }
    }

    await flush();

    return { feedId: targetFeedId, products, batches };
  }

  private getFeed(feedKey: string): ReactionaryFeedDefinition {
    const feed = this.options.feeds[feedKey];

    if (!feed) {
      throw new Error(`ACP feed definition not found: ${feedKey}`);
    }

    return feed;
  }

  private async request(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<unknown> {
    const url = `${this.options.feedApiBaseUrl.replace(/\/+$/, '')}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'api-version': ACP_FEED_API_VERSION,
        accept: 'application/json',
        ...(body === undefined
          ? {}
          : { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`ACP Feed API ${method} ${path} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    return text ? JSON.parse(text) : {};
  }
}

/** Where the agent's Feed API is, as handed out by the agent's onboarding. */
export interface ACPFeedApiConfig {
  /** Base URL of the agent-hosted Feed API. */
  baseUrl: string;
  /** Environment variable holding the API key; defaults to `ACP_FEED_API_KEY`. */
  apiKeyEnv?: string;
}

export interface ACPFeedPublishingConfig
  extends ReactionaryFeedInventoryOptions,
    ReactionaryFeedProcessingOptions {
  acpFeedApi?: ACPFeedApiConfig;
  feeds: Record<string, ReactionaryFeedDefinition>;
}

/**
 * A publisher from a feeds config module, reading the API key from the
 * environment so it never lives in configuration. `testMode` limits each
 * feed to two search pages.
 */
export function createACPFeedPublisherFromConfig<TClient extends ReactionaryFeedClient>(
  config: ACPFeedPublishingConfig,
  clientFactory: ReactionaryFeedClientFactory<TClient>,
  options: {
    env?: Record<string, string | undefined>;
    batchSize?: number;
    testMode?: boolean;
    fetch?: typeof fetch;
    onProgress?: (progress: ReactionaryFeedProgress) => void;
  } = {},
): ReactionaryACPFeedPublisher<TClient> {
  if (!config.acpFeedApi?.baseUrl) {
    throw new Error('The feeds config needs acpFeedApi.baseUrl: the agent\'s Feed API base URL from onboarding.');
  }

  const apiKeyEnv = config.acpFeedApi.apiKeyEnv ?? DEFAULT_ACP_FEED_API_KEY_ENV;
  const apiKey = (options.env ?? process.env)[apiKeyEnv];

  if (!apiKey) {
    throw new Error(`The ACP Feed API key is missing; set the ${apiKeyEnv} environment variable.`);
  }

  const feeds = options.testMode
    ? Object.fromEntries(Object.entries(config.feeds).map(([key, feed]) => [key, { ...feed, maxPages: Math.min(feed.maxPages ?? 2, 2) }]))
    : config.feeds;

  return new ReactionaryACPFeedPublisher(clientFactory, {
    feedApiBaseUrl: config.acpFeedApi.baseUrl,
    apiKey,
    feeds,
    defaultFulfillmentCenterKeys: config.defaultFulfillmentCenterKeys,
    productConcurrency: config.productConcurrency,
    ...(options.batchSize ? { batchSize: options.batchSize } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  });
}
