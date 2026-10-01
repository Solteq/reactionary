import { MemoryCache, type RequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { ReactionaryACPServer } from './reactionary-acp-server.js';

describe('ReactionaryACPServer', () => {
  it('creates fetch and Node handlers', () => {
    const server = new ReactionaryACPServer(() => ({}));

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('serves a framework readiness response', async () => {
    const server = new ReactionaryACPServer(() => ({}), {
      name: 'test-acp',
      version: '1.2.3',
    });

    const response = await server.fetch(new Request('http://127.0.0.1/acp'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('acp-session-id')).toBeTruthy();
    expect(body).toEqual({
      name: 'test-acp',
      version: '1.2.3',
      protocol: 'acp',
      status: 'ready',
      actions: [],
    });
  });

  it('persists request context session state by ACP session id', async () => {
    const observedSessions: RequestContext['session'][] = [];
    const server = new ReactionaryACPServer(
      (requestContext) => {
        observedSessions.push({ ...requestContext.session });
        requestContext.session['test.marker'] = 'saved';
        return {};
      },
      { sessionCache: new MemoryCache() },
    );

    const first = await server.fetch(new Request('http://127.0.0.1/acp'));
    const sessionId = first.headers.get('acp-session-id');

    expect(sessionId).toBeTruthy();

    await server.fetch(
      new Request('http://127.0.0.1/acp', {
        headers: {
          'acp-session-id': sessionId ?? '',
        },
      }),
    );

    expect(observedSessions[1]?.['test.marker']).toBe('saved');
  });

  it('returns an explicit placeholder for unimplemented ACP actions', async () => {
    const server = new ReactionaryACPServer(() => ({}));

    const response = await server.fetch(
      new Request('http://127.0.0.1/acp', {
        method: 'POST',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: {
        code: 'ACP_ACTIONS_NOT_IMPLEMENTED',
      },
    });
  });
});
