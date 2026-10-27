import {
  AnalyticsCapability,
  BaseCapability,
  getReactionaryEntrypoints,
  type ReactionaryEntrypointMetadata,
} from '@reactionary/core';

export interface ReactionaryMCPTool {
  name: string;
  capability: BaseCapability;
  entrypoint: ReactionaryEntrypointMetadata;
}

export type ReactionaryMCPClient = object;

export interface DiscoverReactionaryMCPToolsOptions {
  toolName?: (capabilityName: string, methodName: string) => string;
}

const defaultToolName = (capabilityName: string, methodName: string): string =>
  `${capabilityName}.${methodName}`;

export function discoverReactionaryMCPTools(
  client: ReactionaryMCPClient,
  options: DiscoverReactionaryMCPToolsOptions = {},
): ReactionaryMCPTool[] {
  const toolName = options.toolName ?? defaultToolName;

  return Object.values(client).flatMap((value) => {
    if (!(value instanceof BaseCapability)) {
      return [];
    }

    // Analytics is storefront telemetry, not something an agent should do, and its helpers carry whole carts and orders as input.
    if (value instanceof AnalyticsCapability) {
      return [];
    }

    return getReactionaryEntrypoints(value).map((entrypoint) => ({
      name: toolName(entrypoint.capabilityName, entrypoint.methodName),
      capability: value,
      entrypoint,
    }));
  });
}
