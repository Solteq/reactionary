import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { createUCPError } from './reactionary-ucp-mapping.js';

export const UCP_SESSION_ID_HEADER = 'ucp-session-id';

/** A failure that maps directly onto an HTTP error response. */
export class UCPHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super('UCP HTTP error');
  }
}

type ProtocolHeaders = Headers | Record<string, string>;

function getSessionId(request: Request): string | undefined {
  return request.headers.get(UCP_SESSION_ID_HEADER) ?? undefined;
}

export function getOrCreateSessionId(request: Request): string {
  return getSessionId(request) ?? crypto.randomUUID();
}

export function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    headers?: ProtocolHeaders;
    omitBody?: boolean;
  } = {},
): Response {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(
    options.omitBody ? null : JSON.stringify(body),
    {
      status: options.status ?? 200,
      headers,
    },
  );
}

/** Decodes a request path segment, answering 400 for a malformed percent-escape. */
export function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    if (error instanceof URIError) {
      throw new UCPHttpError(400, createUCPError('invalid_request', 'The request path contains a malformed percent-escape.'));
    }

    throw error;
  }
}

export async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = toWebHeaders(request.headers);
  const url = toRequestUrl(request);
  const body = await readNodeRequestBody(request);

  try {
    return new Request(url, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    throw new UCPHttpError(400, createUCPError('invalid_request', 'The request method or headers are invalid.'));
  }
}

/** The Host header is client supplied, so it may not form a valid URL. */
function toRequestUrl(request: IncomingMessage): URL {
  try {
    return new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  } catch {
    throw new UCPHttpError(400, createUCPError('invalid_request', 'The request URL or Host header is invalid.'));
  }
}

function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        webHeaders.append(key, entry);
      }
      continue;
    }

    webHeaders.set(key, value);
  }

  return webHeaders;
}

async function readNodeRequestBody(
  request: IncomingMessage,
): Promise<Buffer | null> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return Buffer.concat(chunks);
}

export async function sendWebResponse(
  response: ServerResponse,
  webResponse: Response,
): Promise<void> {
  response.writeHead(
    webResponse.status,
    Object.fromEntries(webResponse.headers.entries()),
  );

  if (!webResponse.body) {
    response.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  response.end(body);
}

/** Constant-time string comparison. */
export function secureEquals(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
