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
  /**
   * Decides which tools are exposed. A tool for which this returns false is not registered, so it can neither be listed nor
   * called. Receives the tool with its final name. All tools are exposed when not set.
   */
  toolFilter?: (tool: ReactionaryMCPTool) => boolean;
}

const defaultToolName = (capabilityName: string, methodName: string): string =>
  `${capabilityName}.${methodName}`;

export function discoverReactionaryMCPTools(
  client: ReactionaryMCPClient,
  options: DiscoverReactionaryMCPToolsOptions = {},
): ReactionaryMCPTool[] {
  const toolName = options.toolName ?? defaultToolName;
  const { toolFilter } = options;

  return Object.values(client).flatMap((value) => {
    if (!(value instanceof BaseCapability)) {
      return [];
    }

    // Analytics is storefront telemetry, not something an agent should do, and its helpers carry whole carts and orders as input.
    if (value instanceof AnalyticsCapability) {
      return [];
    }

    return getReactionaryEntrypoints(value)
      .map((entrypoint) => ({
        name: toolName(entrypoint.capabilityName, entrypoint.methodName),
        capability: value,
        entrypoint,
      }))
      .filter((tool) => toolFilter?.(tool) ?? true);
  });
}
