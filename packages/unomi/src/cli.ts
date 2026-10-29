#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeContract } from './contract/write.js';

const usage = `Usage: reactionary-unomi-schemas --out <dir> [--examples <dir>] [--reactionary-version <v>] [--schema-version <x-y-z>] [--scope <scope>]

Writes the Unomi event and item schemas of @reactionary/unomi as JSON schema files:
  <out>/items/<name>/...        item schemas
  <out>/events/<name>/...       event schemas
  <out>/contract.manifest.json  what was written
  <examples>/<event>.event.json one valid example event per event type (with --examples)`;

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    examples: { type: 'string' },
    'reactionary-version': { type: 'string' },
    'schema-version': { type: 'string' },
    scope: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || !values.out) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

const result = writeContract({
  out: values.out,
  examplesDir: values.examples,
  reactionaryVersion: values['reactionary-version'],
  schemaVersion: values['schema-version'],
  scope: values.scope,
});

for (const dir of result.removed) {
  console.log(`removed  ${dir}`);
}
console.log(`wrote ${result.written.length} files to ${values.out}${values.examples ? ` and ${values.examples}` : ''}`);
