import * as z from 'zod';
import { eventDefinitions, type EventDefinition } from './events.js';
import { itemDefinitions, type ItemDefinition } from './items.js';

export const SCHEMA_VENDOR = 'com.solteq.reactionary';
export const SCHEMA_BASE_URL = 'https://com.solteq.reactionary/schemas/json';
export const DEFAULT_SCHEMA_VERSION = '1-0-0';

const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2019-09/schema';
const UNOMI_EVENT_SCHEMA = 'https://unomi.apache.org/schemas/json/event/1-0-0';
const UNOMI_ITEM_SCHEMA = 'https://unomi.apache.org/schemas/json/item/1-0-0';
const UNOMI_SITE_SCHEMA = 'https://unomi.apache.org/schemas/json/items/site/1-0-0';

/** The definitions typed as their interfaces, so optional members such as `target` can be read on any of them. */
const items: readonly ItemDefinition[] = itemDefinitions;
const events: readonly EventDefinition[] = eventDefinitions;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface GeneratedFile {
  /** Relative to the output directory, forward slashes. */
  readonly path: string;
  readonly document: JsonObject;
}

export interface GenerateOptions {
  /** The `x-y-z` version in `$id` and `self`. Defaults to 1-0-0. */
  readonly schemaVersion?: string;
}

export interface ExampleOptions {
  /** The Unomi scope of the example events. */
  readonly scope?: string;
  /** The `itemId` of the `site` source, which names the sending system. */
  readonly sourceId?: string;
}

/**
 * Zod writes `additionalProperties: false` on objects. Unomi schemas extend the event and item base schemas through `allOf`,
 * so the base properties must stay allowed: objects use `unevaluatedProperties: false` instead.
 */
function normalize(node: JsonValue): JsonValue {
  if (Array.isArray(node)) {
    return node.map(normalize);
  }
  if (node !== null && typeof node === 'object') {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'additionalProperties' && value === false) {
        continue;
      }
      result[key] = normalize(value);
    }
    if (result['type'] === 'object' && 'properties' in result) {
      result['unevaluatedProperties'] = false;
    }
    return result;
  }
  return node;
}

function propertiesDocument(schema: z.ZodObject, header: JsonObject): JsonObject {
  const converted: JsonObject = JSON.parse(JSON.stringify(z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' })));
  delete converted['$schema'];
  const normalized = normalize(converted);
  if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error('Expected an object schema');
  }
  return { ...header, ...normalized };
}

function schemaId(kind: 'items' | 'events', name: string, version: string, properties = false): string {
  return `${SCHEMA_BASE_URL}/${kind}/${name}/${properties ? 'properties/' : ''}${version}`;
}

function self(name: string, version: string, target?: 'events'): JsonObject {
  return { vendor: SCHEMA_VENDOR, ...(target ? { target } : {}), name, format: 'jsonschema', version };
}

function itemFiles(item: ItemDefinition, version: string): GeneratedFile[] {
  const propertiesId = schemaId('items', item.name, version, true);
  return [
    {
      path: `items/${item.name}/${item.name}.json`,
      document: {
        $id: schemaId('items', item.name, version),
        $schema: JSON_SCHEMA_DRAFT,
        self: self(item.name, version),
        title: `${item.title}Item`,
        description: item.description,
        type: 'object',
        allOf: [{ $ref: UNOMI_ITEM_SCHEMA }],
        properties: {
          itemType: { const: item.name },
          ...(item.itemIdPattern ? { itemId: { pattern: item.itemIdPattern } } : {}),
          properties: { $ref: propertiesId },
        },
        required: ['itemId', 'itemType', 'properties'],
        unevaluatedProperties: false,
      },
    },
    {
      path: `items/${item.name}/${item.name}.properties.json`,
      document: propertiesDocument(item.properties, {
        $id: propertiesId,
        $schema: JSON_SCHEMA_DRAFT,
        self: self(`${item.name}Properties`, version),
        title: `${item.title}Properties`,
      }),
    },
  ];
}

function eventFiles(event: EventDefinition, version: string): GeneratedFile[] {
  const propertiesId = schemaId('events', event.name, version, true);
  const properties: JsonObject = {
    eventType: { const: event.name },
    source: { $ref: UNOMI_SITE_SCHEMA },
    ...(event.target ? { target: { $ref: schemaId('items', event.target, version) } } : {}),
    properties: { $ref: propertiesId },
  };
  return [
    {
      path: `events/${event.name}/${event.name}.json`,
      document: {
        $id: schemaId('events', event.name, version),
        $schema: JSON_SCHEMA_DRAFT,
        self: self(event.name, version, 'events'),
        title: `${event.title}Event`,
        description: event.description,
        type: 'object',
        allOf: [{ $ref: UNOMI_EVENT_SCHEMA }],
        properties,
        required: ['eventType', 'source', ...(event.target ? ['target'] : []), 'properties'],
        unevaluatedProperties: false,
      },
    },
    {
      path: `events/${event.name}/${event.name}.properties.json`,
      document: propertiesDocument(event.properties, {
        $id: propertiesId,
        $schema: JSON_SCHEMA_DRAFT,
        self: self(`${event.name}Properties`, version),
        title: `${event.title}Properties`,
      }),
    },
  ];
}

/** Every item and event schema of the contract as Unomi JSON schema documents, sorted by path. */
export function generateSchemas(options: GenerateOptions = {}): GeneratedFile[] {
  const version = options.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  const files = [
    ...items.flatMap((item) => itemFiles(item, version)),
    ...events.flatMap((event) => eventFiles(event, version)),
  ];
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** One valid event as it is posted to Unomi, for each event of the contract. */
export function generateExamples(options: ExampleOptions = {}): GeneratedFile[] {
  const scope = options.scope ?? 'reactionary-storefront';
  const sourceId = options.sourceId ?? 'reactionary';
  return events.map((event) => {
    const target = event.target && event.example.target
      ? { target: { itemType: event.target, itemId: event.example.target.itemId, scope, properties: event.example.target.properties } }
      : {};
    const document: JsonObject = JSON.parse(JSON.stringify({
      eventType: event.name,
      scope,
      source: { itemType: 'site', itemId: sourceId, scope },
      ...target,
      properties: event.example.properties,
    }));
    return { path: `${event.name}.event.json`, document };
  });
}

/** What was generated, for the CDP repository to record next to the schemas. */
export function generateManifest(options: GenerateOptions & { readonly reactionaryVersion?: string } = {}): JsonObject {
  return {
    vendor: SCHEMA_VENDOR,
    schemaVersion: options.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    ...(options.reactionaryVersion ? { reactionaryVersion: options.reactionaryVersion } : {}),
    items: items.map((item) => item.name),
    events: events.map((event) => ({ name: event.name, analyticsType: event.analyticsType, target: event.target ?? null })),
  };
}
