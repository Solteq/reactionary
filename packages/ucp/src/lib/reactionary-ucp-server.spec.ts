import { MemoryCache, type RequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

describe('ReactionaryUCPServer', () => {
  it('creates fetch and Node handlers', () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('serves a framework readiness response', async () => {
    const server = new ReactionaryUCPServer(() => ({}), {
      name: 'test-ucp',
      version: '1.2.3',
    });

    const response = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('ucp-session-id')).toBeTruthy();
    expect(body).toEqual({
      name: 'test-ucp',
      version: '1.2.3',
      protocol: 'ucp',
      status: 'ready',
      actions: [],
    });
  });

  it('persists request context session state by UCP session id', async () => {
    const observedSessions: RequestContext['session'][] = [];
    const server = new ReactionaryUCPServer(
      (requestContext) => {
        observedSessions.push({ ...requestContext.session });
        requestContext.session['test.marker'] = 'saved';
        return {};
      },
      { sessionCache: new MemoryCache() },
    );

    const first = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const sessionId = first.headers.get('ucp-session-id');

    expect(sessionId).toBeTruthy();

    await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: {
          'ucp-session-id': sessionId ?? '',
        },
      }),
    );

    expect(observedSessions[1]?.['test.marker']).toBe('saved');
  });

  it('returns an explicit placeholder for unimplemented UCP actions', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    const response = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: {
        code: 'UCP_ACTIONS_NOT_IMPLEMENTED',
      },
    });
  });
});
