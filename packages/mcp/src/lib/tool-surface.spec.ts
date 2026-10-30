import { BaseCapability, getReactionaryEntrypoints } from '@reactionary/core';
import * as algolia from '@reactionary/algolia';
import * as bazaarvoice from '@reactionary/bazaarvoice';
import * as commercetools from '@reactionary/commercetools';
import * as fake from '@reactionary/fake';
import * as hcl from '@reactionary/hcl';
import * as magento from '@reactionary/magento';
import * as medusa from '@reactionary/medusa';
import * as meilisearch from '@reactionary/meilisearch';
import * as unomi from '@reactionary/unomi';
import { describe, expect, it } from 'vitest';
import { TOOL_DESCRIPTIONS } from './tool-descriptions.js';

// The providers of this package, and the others that the core capabilities have operations of that these do not
const providers: Record<string, Record<string, unknown>> = {
  algolia,
  bazaarvoice,
  commercetools,
  fake,
  hcl,
  magento,
  medusa,
  meilisearch,
  unomi,
};

interface Operation {
  provider: string;
  name: string;
  type: string;
  description: string | undefined;
}

/**
 * Every operation that a provider of this package offers as a tool. The capability classes are taken from what the
 * packages export and not built into a client, so every capability of a provider is looked at and no configuration is needed.
 */
function operations(): Operation[] {
  const found: Operation[] = [];
  for (const [provider, exports] of Object.entries(providers)) {
    for (const value of Object.values(exports)) {
      if (typeof value !== 'function' || !(value.prototype instanceof BaseCapability)) {
        continue;
      }
      const capability = Object.create(value.prototype) as BaseCapability;
      for (const entrypoint of getReactionaryEntrypoints(capability)) {
        const def = (entrypoint.inputSchema as unknown as { _zod: { def: { type: string } } })._zod.def;
        found.push({
          provider,
          name: `${entrypoint.capabilityName}.${entrypoint.methodName}`,
          type: def.type,
          description: entrypoint.description ?? TOOL_DESCRIPTIONS[`${entrypoint.capabilityName}.${entrypoint.methodName}`],
        });
      }
    }
  }
  return found;
}

describe('the tools of the providers', () => {
  const all = operations();

  it('finds the operations of every provider', () => {
    expect(new Set(all.map((operation) => operation.provider))).toEqual(new Set(Object.keys(providers)));
    expect(all.length).toBeGreaterThan(200);
  });

  it('declare an input schema, so that agents are told what they take', () => {
    // An operation without one is published as taking anything, and an agent has to guess its input
    const without = all.filter((operation) => operation.type === 'unknown' || operation.type === 'any');

    expect(without.map((operation) => `${operation.provider}: ${operation.name}`)).toEqual([]);
  });

  it('have a description', () => {
    const without = [...new Set(all.filter((operation) => !operation.description).map((operation) => operation.name))];

    expect(without.sort()).toEqual([]);
  });

  it('have no description for an operation that no provider has', () => {
    const names = new Set(all.map((operation) => operation.name));

    expect(Object.keys(TOOL_DESCRIPTIONS).filter((name) => !names.has(name))).toEqual([]);
  });
});

describe('the descriptions of the tools', () => {
  it.each(Object.entries(TOOL_DESCRIPTIONS))('%s is written for an agent', (_name, description) => {
    expect(description.length).toBeGreaterThanOrEqual(40);
    expect(description).toMatch(/^[A-Z]/);
    expect(description).toMatch(/[.)"]$/);
    // what is left of notes to the developers of the library
    expect(description).not.toMatch(/TODO|FIXME|Usecase|HOW did/i);
  });
});
