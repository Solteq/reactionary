import { BaseCapability } from '@reactionary/core';
import type { ReactionaryUCPClient } from './reactionary-ucp-common.js';

export function hasCapability(
  client: ReactionaryUCPClient,
  name: string,
): boolean {
  return Boolean(getCapability(client, name));
}

export function getCapability(
  client: ReactionaryUCPClient,
  name: string,
): BaseCapability | undefined {
  return Object.values(client).find((value) => (
    value instanceof BaseCapability &&
    getCapabilityResourceName(value) === name
  ));
}

function getCapabilityResourceName(
  capability: BaseCapability,
): string {
  const getResourceName: unknown = Reflect.get(capability, 'getResourceName');
  if (typeof getResourceName !== 'function') {
    return '';
  }

  return Reflect.apply(getResourceName, capability, []) as string;
}
