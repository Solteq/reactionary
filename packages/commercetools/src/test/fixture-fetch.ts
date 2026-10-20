import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { afterEach, beforeEach, vi } from 'vitest';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';

/**
 * Record/replay of Commercetools HTTP traffic, so specs can run offline.
 *
 * By default, specs replay the interactions stored under __fixtures__/<suite>/<test>.json
 * against a fake configuration. Run with CT_RECORD=1 to execute against the live project
 * configured in the repository's .test.env and (re-)record the fixtures instead.
 */
export const isRecording = process.env['CT_RECORD'] === '1';

const FIXTURES = new URL('./__fixtures__/', import.meta.url);
const TEST_ENV = new URL('../../../../.test.env', import.meta.url);

// Tokens and client identifiers are never written to fixtures.
const REDACTED_KEYS = new Set(['access_token', 'refresh_token', 'client_id', 'clientId']);

const realFetch = globalThis.fetch;

interface RecordedInteraction {
  method: string;
  url: string;
  status: number;
  contentType: string | null;
  body: unknown;
}

interface Cassette {
  interactions: RecordedInteraction[];
}

function getFixtureConfiguration(): CommercetoolsConfiguration {
  if (isRecording) {
    loadEnv({ path: TEST_ENV.pathname, quiet: true });
    return getCommercetoolsTestConfiguration();
  }

  return {
    ...getCommercetoolsTestConfiguration(),
    apiUrl: 'https://api.commercetools.test',
    authUrl: 'https://auth.commercetools.test',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    projectKey: 'test-project',
    scopes: [],
  };
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sanitize(value: unknown, projectKey: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, projectKey));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (typeof entry === 'string' && REDACTED_KEYS.has(key)) {
          return [key, `redacted-${key}`];
        }
        // OAuth scopes are formatted as <scope>:<projectKey>
        if (typeof entry === 'string' && key === 'scope') {
          return [key, entry.replaceAll(`:${projectKey}`, ':{projectKey}')];
        }
        return [key, sanitize(entry, projectKey)];
      }),
    );
  }

  return value;
}

function describeRequest(input: string | URL | Request, init?: RequestInit) {
  const url = input instanceof Request ? input.url : input.toString();
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

  return { url, method };
}

/**
 * Registers record/replay hooks for the surrounding describe block and returns
 * the configuration that specs should construct their clients with.
 */
export function useCommercetoolsFixtures(suite: string): CommercetoolsConfiguration {
  const config = getFixtureConfiguration();
  const projectSegment = new RegExp(`/${config.projectKey}(?=/|\\?|$)`, 'g');

  const normalizeUrl = (url: string) =>
    url
      .replace(config.authUrl, '{authUrl}')
      .replace(config.apiUrl, '{apiUrl}')
      .replace(projectSegment, '/{projectKey}');

  let cassettePath: URL;
  let interactions: RecordedInteraction[] = [];
  let consumed = new Set<number>();

  const recordingFetch: typeof fetch = async (input, init) => {
    const { url, method } = describeRequest(input, init);
    const response = await realFetch(input, init);
    const contentType = response.headers.get('content-type');
    const text = await response.clone().text();
    const isJson = contentType?.includes('json') ?? false;

    interactions.push({
      method,
      url: normalizeUrl(url),
      status: response.status,
      contentType,
      body: isJson && text ? sanitize(JSON.parse(text), config.projectKey) : text,
    });

    return response;
  };

  const replayingFetch: typeof fetch = async (input, init) => {
    const { url, method } = describeRequest(input, init);
    const normalized = normalizeUrl(url);
    const index = interactions.findIndex(
      (interaction, i) => !consumed.has(i) && interaction.method === method && interaction.url === normalized,
    );

    if (index === -1) {
      throw new Error(
        `No recorded Commercetools interaction for ${method} ${normalized} in ${cassettePath.pathname}. ` +
          'Re-record the fixtures with CT_RECORD=1.',
      );
    }

    consumed.add(index);
    const interaction = interactions[index];
    const body =
      typeof interaction.body === 'string' ? interaction.body : JSON.stringify(interaction.body);

    return new Response(body || null, {
      status: interaction.status,
      headers: interaction.contentType ? { 'content-type': interaction.contentType } : {},
    });
  };

  beforeEach((context) => {
    cassettePath = new URL(`${suite}/${slugify(context.task.name)}.json`, FIXTURES);
    consumed = new Set();

    if (isRecording) {
      interactions = [];
    } else {
      const cassette: Cassette = existsSync(cassettePath)
        ? JSON.parse(readFileSync(cassettePath, 'utf8'))
        : { interactions: [] };
      interactions = cassette.interactions;
    }

    vi.stubGlobal('fetch', isRecording ? recordingFetch : replayingFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (isRecording) {
      if (interactions.length > 0) {
        mkdirSync(new URL('.', cassettePath), { recursive: true });
        writeFileSync(cassettePath, JSON.stringify({ interactions } satisfies Cassette, null, 2) + '\n');
      }
      return;
    }

    const unused = interactions.filter((_, i) => !consumed.has(i));
    if (unused.length > 0) {
      throw new Error(
        `Recorded Commercetools interactions were not requested: ` +
          unused.map((interaction) => `${interaction.method} ${interaction.url}`).join(', '),
      );
    }
  });

  return config;
}
