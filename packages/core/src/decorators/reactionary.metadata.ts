import type * as z from 'zod';

export const REACTIONARY_ENTRYPOINT_METADATA = Symbol.for(
  '@reactionary/entrypoint-metadata',
);

export interface ReactionaryEntrypointMetadata {
  capabilityName: string;
  methodName: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  title?: string;
  description?: string;
  cache: boolean;
  localeDependentCaching: boolean;
  currencyDependentCaching: boolean;
  cacheTimeToLiveInSeconds: number;
}

export type ReactionaryEntrypointMethod = ((...args: unknown[]) => unknown) & {
  [REACTIONARY_ENTRYPOINT_METADATA]?: Omit<
    ReactionaryEntrypointMetadata,
    'capabilityName'
  >;
};
