import type {
  ReactionaryFeedDefinition,
  ReactionaryFeedProduct,
} from './feed-types.js';

export interface ReactionaryFeedTransformContext<TOptions = unknown> {
  feedId: string;
  feed: ReactionaryFeedDefinition;
  options: TOptions;
}

export interface ReactionaryFeedTransformer<TOptions = unknown> {
  id: string;
  title: string;
  description?: string;
  output: {
    contentType: string;
    fileExtension: string;
  };
  defaultOptions?: TOptions;
  transform(
    products: AsyncIterable<ReactionaryFeedProduct>,
    context: ReactionaryFeedTransformContext<TOptions>,
  ): AsyncIterable<string | Uint8Array>;
}

export interface ReactionaryFeedTransformerSummary {
  id: string;
  title: string;
  description?: string;
  contentType: string;
  fileExtension: string;
}

export class ReactionaryFeedTransformerRegistry {
  private readonly transformers = new Map<string, ReactionaryFeedTransformer>();

  public register(transformer: ReactionaryFeedTransformer): void {
    this.transformers.set(transformer.id, transformer);
  }

  public get(id: string): ReactionaryFeedTransformer | undefined {
    return this.transformers.get(id);
  }

  public list(): ReactionaryFeedTransformerSummary[] {
    return [...this.transformers.values()].map((transformer) => ({
      id: transformer.id,
      title: transformer.title,
      description: transformer.description,
      contentType: transformer.output.contentType,
      fileExtension: transformer.output.fileExtension,
    }));
  }
}
