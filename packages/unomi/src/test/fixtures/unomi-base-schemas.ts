/**
 * The Unomi base schemas the generated event and item schemas build on, as Unomi 3 ships them (copied from the `vendor/` folder of
 * the CDP repository). Only what the contract tests need.
 */
const draft = 'https://json-schema.org/draft/2019-09/schema';
const idPattern = '^(\\w|[-_@\\.]){0,60}$';

export const unomiBaseSchemas = [
  {
    $id: 'https://unomi.apache.org/schemas/json/item/1-0-0',
    $schema: draft,
    self: { vendor: 'org.apache.unomi', name: 'item', format: 'jsonschema', version: '1-0-0' },
    title: 'Item',
    type: 'object',
    properties: {
      itemId: { type: ['null', 'string'], pattern: idPattern },
      itemType: { type: 'string' },
      scope: { type: ['null', 'string'], validateScope: true },
      version: { type: ['null', 'integer'], minimum: 0 },
      properties: { type: ['null', 'object'] },
    },
  },
  {
    $id: 'https://unomi.apache.org/schemas/json/timestampeditem/1-0-0',
    $schema: draft,
    self: { vendor: 'org.apache.unomi', name: 'timestampedItem', format: 'jsonschema', version: '1-0-0' },
    title: 'TimestampedItem',
    type: 'object',
    allOf: [{ $ref: 'https://unomi.apache.org/schemas/json/item/1-0-0' }],
    properties: { timeStamp: { type: ['string', 'integer'] } },
  },
  {
    $id: 'https://unomi.apache.org/schemas/json/event/1-0-0',
    $schema: draft,
    self: { vendor: 'org.apache.unomi', name: 'event', format: 'jsonschema', version: '1-0-0' },
    title: 'Event',
    type: 'object',
    allOf: [{ $ref: 'https://unomi.apache.org/schemas/json/timestampeditem/1-0-0' }],
    properties: {
      eventType: { type: 'string', pattern: '^(\\w|[-_@\\.]){0,60}$' },
      profileId: { type: ['string'], pattern: idPattern },
      sessionId: { type: ['string'], pattern: idPattern },
      scope: { type: ['string'], validateScope: true, pattern: idPattern },
      sourceId: { type: ['string'], pattern: idPattern },
      persistent: { type: 'boolean' },
    },
  },
  {
    $id: 'https://unomi.apache.org/schemas/json/items/site/1-0-0',
    $schema: draft,
    self: { vendor: 'org.apache.unomi', name: 'site', format: 'jsonschema', version: '1-0-0' },
    title: 'SiteItem',
    type: 'object',
    allOf: [{ $ref: 'https://unomi.apache.org/schemas/json/item/1-0-0' }],
    unevaluatedProperties: false,
  },
];
