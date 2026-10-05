import { createInitialRequestContext } from '@reactionary/core';
import {
  ReactionaryFeedGenerator,
  toACPFeedProduct,
  type ACPFeedMetadata,
  type ACPFeedProduct,
  type ReactionaryFeedClient,
  type ReactionaryFeedClientFactory,
  type ReactionaryFeedDefinition,
  type ReactionaryFeedInventoryOptions,
  type ReactionaryFeedProcessingOptions,
} from '@reactionary/feeds';
import * as z from 'zod';

const ACP_FEED_API_VERSION = '2026-04-17';
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
   * agent-hosted feed with `PATCH /feeds/{feedId}/products`. Upserts never
   * remove products; to drop products, replace the feed by file ingestion.
   */
  public async publish(feedKey: string, feedId: string): Promise<ACPFeedPublishResult> {
    const feed = this.getFeed(feedKey);
    const requestContext = createInitialRequestContext();
    requestContext.languageContext = feed.languageContext;

    const generator = new ReactionaryFeedGenerator(this.clientFactory(requestContext), {
      defaultFulfillmentCenterKeys: this.options.defaultFulfillmentCenterKeys,
      productConcurrency: this.options.productConcurrency,
    });
    const batchSize = Math.max(this.options.batchSize ?? DEFAULT_BATCH_SIZE, 1);
    const path = `/feeds/${encodeURIComponent(feedId)}/products`;
    let batch: ACPFeedProduct[] = [];
    let products = 0;
    let batches = 0;

    const flush = async () => {
      if (batch.length === 0) {
        return;
      }

      const response = ACPFeedUpsertResponseSchema.parse(await this.request('PATCH', path, { products: batch }));

      if (!response.accepted) {
        throw new Error(`ACP feed ${feedId}: the agent did not accept the product upsert.`);
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

    return { feedId, products, batches };
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
