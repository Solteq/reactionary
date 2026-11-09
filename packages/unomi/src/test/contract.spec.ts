import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ajv2019, type ValidateFunction } from 'ajv/dist/2019.js';
import addFormats from 'ajv-formats';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  eventDefinitions,
  generateExamples,
  generateManifest,
  generateSchemas,
  itemDefinitions,
  MANIFEST_FILE,
  SCHEMA_BASE_URL,
  unomiItemId,
  writeContract,
  type EventDefinition,
  type ItemDefinition,
} from '../contract/index.js';
import { unomiBaseSchemas } from './fixtures/unomi-base-schemas.js';

const events: readonly EventDefinition[] = eventDefinitions;
const items: readonly ItemDefinition[] = itemDefinitions;

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected an object');
  }
  return { ...value };
}

function child(parent: Obj, key: string): Obj {
  const value = obj(parent[key]);
  parent[key] = value;
  return value;
}

function containsKey(node: unknown, key: string): boolean {
  if (Array.isArray(node)) {
    return node.some((n) => containsKey(n, key));
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).some(([k, v]) => k === key || containsKey(v, key));
  }
  return false;
}

function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((n) => collectRefs(n, found));
  } else if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') {
        found.push(v);
      } else {
        collectRefs(v, found);
      }
    }
  }
  return found;
}

function buildAjv(): Ajv2019 {
  const ajv = new Ajv2019({ strict: false, allErrors: true });
  addFormats.default(ajv);
  for (const schema of unomiBaseSchemas) {
    ajv.addSchema(schema);
  }
  for (const file of generateSchemas()) {
    ajv.addSchema(file.document);
  }
  return ajv;
}

describe('Unomi event contract', () => {
  const files = generateSchemas();
  const examples = generateExamples();
  let ajv: Ajv2019;

  beforeAll(() => {
    ajv = buildAjv();
  });

  function validatorFor(event: EventDefinition): ValidateFunction {
    const validate = ajv.getSchema(`${SCHEMA_BASE_URL}/events/${event.name}/1-0-0`);
    if (!validate) {
      throw new Error(`no schema for ${event.name}`);
    }
    return validate;
  }

  function exampleOf(event: EventDefinition): Obj {
    const found = examples.find((e) => e.path === `${event.name}.event.json`);
    if (!found) {
      throw new Error(`no example for ${event.name}`);
    }
    return obj(JSON.parse(JSON.stringify(found.document)));
  }

  describe('generated schemas', () => {
    it('has an item and a properties document for every item and event', () => {
      expect(files).toHaveLength((items.length + events.length) * 2);
      for (const item of items) {
        expect(files.map((f) => f.path)).toContain(`items/${item.name}/${item.name}.json`);
      }
      for (const event of events) {
        expect(files.map((f) => f.path)).toContain(`events/${event.name}/${event.name}.properties.json`);
      }
    });

    it('gives every document a unique $id under the contract namespace', () => {
      const ids = files.map((f) => String(f.document['$id']));
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id.startsWith(`${SCHEMA_BASE_URL}/`)).toBe(true);
      }
    });

    it('never uses additionalProperties, which would reject the Unomi base properties', () => {
      for (const file of files) {
        expect(containsKey(file.document, 'additionalProperties'), file.path).toBe(false);
      }
    });

    it('closes every event and item with unevaluatedProperties: false', () => {
      for (const file of files.filter((f) => !f.path.endsWith('.properties.json'))) {
        expect(file.document['unevaluatedProperties'], file.path).toBe(false);
      }
    });

    it('gives every schema a self.name of letters only, which is all Unomi accepts (letters and _)', () => {
      for (const file of files) {
        expect(String(obj(file.document['self'])['name']), file.path).toMatch(/^[A-Za-z_]+$/);
      }
    });

    it('registers events by their event type under self.target "events"', () => {
      for (const event of events) {
        const doc = files.find((f) => f.path === `events/${event.name}/${event.name}.json`)?.document;
        expect(obj(doc?.['self'])).toMatchObject({ vendor: 'com.solteq.reactionary', target: 'events', name: event.name, format: 'jsonschema' });
      }
    });

    it('resolves every $ref against the generated and the Unomi base schemas', () => {
      for (const file of files) {
        for (const ref of collectRefs(file.document)) {
          expect(ajv.getSchema(ref), `${file.path} -> ${ref}`).toBeDefined();
        }
      }
    });

    it('compiles', () => {
      for (const event of events) {
        expect(() => validatorFor(event)).not.toThrow();
      }
    });
  });

  describe('example events', () => {
    it.each(events.map((e) => [e.name, e] as const))('%s validates against its JSON schema', (_name, event) => {
      const validate = validatorFor(event);
      const example = exampleOf(event);
      expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
    });

    it.each(events.map((e) => [e.name, e] as const))('%s also parses with its Zod schemas', (_name, event) => {
      expect(() => event.properties.parse(event.example.properties)).not.toThrow();
      if (event.target) {
        const item = items.find((i) => i.name === event.target);
        expect(item, `item ${event.target}`).toBeDefined();
        expect(() => item?.properties.parse(event.example.target?.properties)).not.toThrow();
      }
    });

    it('has a target exactly when the event defines one', () => {
      for (const event of events) {
        expect('target' in exampleOf(event), event.name).toBe(event.target !== undefined);
      }
    });

    it('uses item ids that Unomi accepts', () => {
      for (const event of events) {
        const target = exampleOf(event)['target'];
        if (target) {
          expect(unomiItemId(String(obj(target)['itemId']))).toBe(obj(target)['itemId']);
        }
      }
    });
  });

  describe('strictness', () => {
    const productViewed = events.find((e) => e.name === 'productViewed');
    if (!productViewed) {
      throw new Error('productViewed missing');
    }

    it('rejects an unknown property on the event', () => {
      const example = exampleOf(productViewed);
      example['surprise'] = true;
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('rejects an unknown property in the event properties', () => {
      const example = exampleOf(productViewed);
      child(example, 'properties')['surprise'] = true;
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('rejects an unknown property in the target item properties', () => {
      const example = exampleOf(productViewed);
      const target = child(example, 'target');
      child(target, 'properties')['surprise'] = true;
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('rejects an unknown property in a nested origin', () => {
      const example = exampleOf(productViewed);
      child(child(example, 'properties'), 'origin')['position'] = 3;
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it.each([
      '2026-10-29T13:45:09.123Z',
      '2026-10-29T13:45:09Z',
      '2026-10-29T15:45:09.1+02:00',
      '2026-10-29T08:45:09-0500',
      '2026-10-29T15:45:09+02',
      '2026-02-30T25:61:61Z',
    ])('accepts the fxDate %s, the shape is checked and not the calendar', (fxDate) => {
      const example = exampleOf(productViewed);
      child(example, 'properties')['fxDate'] = fxDate;
      expect(validatorFor(productViewed)(example), JSON.stringify(validatorFor(productViewed).errors)).toBe(true);
      expect(productViewed.properties.safeParse({ ...productViewed.example.properties, fxDate }).success).toBe(true);
    });

    it.each([
      '2026-10-29',
      '2026-10-29T13:45:09',
      '2026-10-29 13:45:09Z',
      '20261029T134509Z',
      '2026-10-29T13:45Z',
      '2026-10-29T13:45:09.Z',
      '2026-10-29T13:45:09z',
      '',
    ])('rejects the fxDate "%s"', (fxDate) => {
      const example = exampleOf(productViewed);
      child(example, 'properties')['fxDate'] = fxDate;
      expect(validatorFor(productViewed)(example)).toBe(false);
      expect(productViewed.properties.safeParse({ ...productViewed.example.properties, fxDate }).success).toBe(false);
    });

    it('rejects a missing required product field', () => {
      const example = exampleOf(productViewed);
      delete child(child(example, 'target'), 'properties')['categoryIds'];
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('rejects a target of the wrong item type', () => {
      const example = exampleOf(productViewed);
      child(example, 'target')['itemType'] = 'category';
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('rejects an item id Unomi would drop', () => {
      const example = exampleOf(productViewed);
      child(example, 'target')['itemId'] = 'features/cordless';
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('requires a source', () => {
      const example = exampleOf(productViewed);
      delete example['source'];
      expect(validatorFor(productViewed)(example)).toBe(false);
    });

    it('rejects a target on an event that has none', () => {
      const newsletter = events.find((e) => e.name === 'newsletterSubscribed');
      if (!newsletter) {
        throw new Error('newsletterSubscribed missing');
      }
      const example = exampleOf(newsletter);
      example['target'] = { itemType: 'product', itemId: 'p1', properties: {} };
      expect(validatorFor(newsletter)(example)).toBe(false);
    });

    it('requires the experiment item id to be exp.<key>.<version>', () => {
      const exposed = events.find((e) => e.name === 'experimentExposed');
      if (!exposed) {
        throw new Error('experimentExposed missing');
      }
      for (const itemId of ['hero-banner', 'exp.hero-banner', 'hero.b', 'exp.Hero.b']) {
        const example = exampleOf(exposed);
        child(example, 'target')['itemId'] = itemId;
        expect(validatorFor(exposed)(example), itemId).toBe(false);
      }
    });

    it('requires the trait item id to be <trait>.<value>', () => {
      const declared = events.find((e) => e.name === 'traitDeclared');
      if (!declared) {
        throw new Error('traitDeclared missing');
      }
      for (const itemId of ['trade', 'trade:electrician', 'Trade.electrician']) {
        const example = exampleOf(declared);
        child(example, 'target')['itemId'] = itemId;
        expect(validatorFor(declared)(example), itemId).toBe(false);
      }
    });

    it('keeps the combined experiment and trait ids within what Unomi accepts at the longest slugs', () => {
      expect(unomiItemId(`exp.${'k'.repeat(40)}.${'v'.repeat(12)}`)).toBe(`exp.${'k'.repeat(40)}.${'v'.repeat(12)}`);
      expect(unomiItemId(`${'t'.repeat(29)}.${'v'.repeat(29)}`)).toBe(`${'t'.repeat(29)}.${'v'.repeat(29)}`);
    });

    it('rejects a trait with an upper case name', () => {
      const trait = events.find((e) => e.name === 'traitDeclared');
      if (!trait) {
        throw new Error('traitDeclared missing');
      }
      const example = exampleOf(trait);
      child(child(example, 'target'), 'properties')['trait'] = 'Trade';
      expect(validatorFor(trait)(example)).toBe(false);
    });

    it('rejects an order without the flat arrays', () => {
      const placed = events.find((e) => e.name === 'orderPlaced');
      if (!placed) {
        throw new Error('orderPlaced missing');
      }
      const example = exampleOf(placed);
      delete child(child(example, 'target'), 'properties')['conceptIds'];
      expect(validatorFor(placed)(example)).toBe(false);
    });
  });

  describe('contract shape', () => {
    it('names events in lowerCamelCase', () => {
      for (const event of events) {
        expect(event.name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      }
    });

    it('maps each event to a distinct reactionary analytics type', () => {
      const types = events.map((e) => e.analyticsType);
      expect(new Set(types).size).toBe(types.length);
    });

    it('carries concepts and categories on every product-like target', () => {
      for (const name of ['product', 'line']) {
        const item = items.find((i) => i.name === name);
        expect(Object.keys(item?.properties.shape ?? {})).toEqual(expect.arrayContaining(['categoryIds', 'conceptIds']));
      }
    });

    it('lists every event and item in the manifest', () => {
      const manifest = generateManifest({ reactionaryVersion: '0.13.0' });
      expect(manifest['items']).toEqual(items.map((i) => i.name));
      expect(manifest['reactionaryVersion']).toBe('0.13.0');
      expect(Array.isArray(manifest['events']) ? manifest['events'].length : 0).toBe(events.length);
    });
  });
});

describe('unomiItemId', () => {
  it('keeps a key Unomi accepts', () => {
    expect(unomiItemId('prod_01J9X')).toBe('prod_01J9X');
    expect(unomiItemId('a.b-c@d_e')).toBe('a.b-c@d_e');
  });

  it('hashes a key with a character Unomi does not accept', () => {
    const id = unomiItemId('features/cordless');
    expect(id).toMatch(/^h-[0-9a-f]{40}$/);
    expect(unomiItemId('features/cordless')).toBe(id);
    expect(unomiItemId('features/corded')).not.toBe(id);
  });

  it('hashes a key that is too long and an empty key', () => {
    expect(unomiItemId('x'.repeat(61))).toMatch(/^h-[0-9a-f]{40}$/);
    expect(unomiItemId('x'.repeat(60))).toBe('x'.repeat(60));
    expect(unomiItemId('')).toMatch(/^h-[0-9a-f]{40}$/);
  });

  it('always produces an id the item schema accepts', () => {
    const ajv = buildAjv();
    const validate = ajv.getSchema('https://unomi.apache.org/schemas/json/item/1-0-0');
    for (const key of ['', 'a b', 'ü', 'x'.repeat(200), 'ok']) {
      expect(validate?.({ itemId: unomiItemId(key), itemType: 'product' }), key).toBe(true);
    }
  });
});

describe('writeContract', () => {
  const dirs: string[] = [];
  const tmp = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'unomi-contract-'));
    dirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes the schemas, a manifest and the examples', () => {
    const out = tmp();
    const examplesDir = tmp();
    const result = writeContract({ out, examplesDir, reactionaryVersion: '0.13.0' });
    expect(existsSync(join(out, 'events/productViewed/productViewed.json'))).toBe(true);
    expect(existsSync(join(out, 'items/product/product.properties.json'))).toBe(true);
    expect(existsSync(join(examplesDir, 'orderPlaced.event.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(out, MANIFEST_FILE), 'utf-8')).reactionaryVersion).toBe('0.13.0');
    expect(result.removed).toEqual([]);
  });

  it('removes what an earlier run wrote and the contract no longer has, and nothing else', () => {
    const out = tmp();
    writeContract({ out });
    mkdirSync(join(out, 'events/retiredEvent'), { recursive: true });
    writeFileSync(join(out, 'events/retiredEvent/retiredEvent.json'), '{}');
    const manifestPath = join(out, MANIFEST_FILE);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifest.events.push({ name: 'retiredEvent', analyticsType: 'retired', target: null });
    writeFileSync(manifestPath, JSON.stringify(manifest));
    mkdirSync(join(out, 'events/handMade'), { recursive: true });
    writeFileSync(join(out, 'events/handMade/handMade.json'), '{}');

    const result = writeContract({ out });
    expect(existsSync(join(out, 'events/retiredEvent'))).toBe(false);
    expect(existsSync(join(out, 'events/handMade/handMade.json'))).toBe(true);
    expect(result.removed.some((r) => r.endsWith('retiredEvent'))).toBe(true);
  });

  it('is stable: a second run writes the same bytes', () => {
    const out = tmp();
    writeContract({ out });
    const first = readFileSync(join(out, 'events/orderPlaced/orderPlaced.json'), 'utf-8');
    writeContract({ out });
    expect(readFileSync(join(out, 'events/orderPlaced/orderPlaced.json'), 'utf-8')).toBe(first);
  });
});
