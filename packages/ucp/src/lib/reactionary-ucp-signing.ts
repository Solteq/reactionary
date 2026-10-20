import { createHash, createPrivateKey, sign, type JsonWebKey, type KeyObject } from 'node:crypto';

/**
 * A business signing key for UCP message signatures (RFC 9421). Its public
 * part must be published under `keys` in the business profile; see
 * toPublicSigningJwk.
 */
export interface UCPSigningKey {
  /** The key id, referenced as `keyid` in signatures and `kid` in the profile. */
  kid: string;
  /** The private key as a JWK: EC P-256 (ES256), EC P-384 (ES384) or OKP Ed25519. */
  privateKeyJwk: JsonWebKey;
}

export interface UCPSignableRequest {
  method: string;
  url: string;
  /** Request headers by lower-case name; signed when listed as components. */
  headers: Record<string, string>;
  body: string;
}

/** The public JWK to publish in the business profile's `keys` for a signing key. */
export function toPublicSigningJwk(key: UCPSigningKey): Record<string, string> {
  const { kty, crv, x, y } = key.privateKeyJwk;

  return {
    kid: key.kid,
    ...(kty ? { kty } : {}),
    ...(crv ? { crv } : {}),
    ...(x ? { x } : {}),
    ...(y ? { y } : {}),
    use: 'sig',
    alg: getAlgorithm(key.privateKeyJwk).alg,
  };
}

/**
 * Signs a REST request per the UCP REST binding of RFC 9421: computes the
 * Content-Digest (RFC 9530) of the raw body and signs the required
 * components, returning the headers to add.
 */
export function signRestRequest(
  request: UCPSignableRequest,
  key: UCPSigningKey,
  created = Math.floor(Date.now() / 1000),
): Record<string, string> {
  const url = new URL(request.url);
  const headers: Record<string, string> = {
    ...request.headers,
    'content-digest': `sha-256=:${createHash('sha256').update(request.body).digest('base64')}:`,
  };
  const components = [
    '@method',
    '@authority',
    '@path',
    ...(url.search ? ['@query'] : []),
    ...['ucp-agent', 'idempotency-key', 'content-digest', 'content-type'].filter((name) => headers[name] !== undefined),
  ];
  const signatureParams = `(${components.map((name) => `"${name}"`).join(' ')});created=${created};keyid="${key.kid}"`;
  const signatureBase = [
    ...components.map((name) => `"${name}": ${getComponentValue(name, request.method, url, headers)}`),
    `"@signature-params": ${signatureParams}`,
  ].join('\n');

  return {
    'content-digest': headers['content-digest'],
    'signature-input': `sig1=${signatureParams}`,
    'signature': `sig1=:${createSignature(signatureBase, key).toString('base64')}:`,
  };
}

function getComponentValue(
  name: string,
  method: string,
  url: URL,
  headers: Record<string, string>,
): string {
  switch (name) {
    case '@method':
      return method.toUpperCase();
    case '@authority':
      return url.host.toLowerCase();
    case '@path':
      return url.pathname;
    case '@query':
      return url.search;
    default:
      return (headers[name] ?? '').trim();
  }
}

function createSignature(signatureBase: string, key: UCPSigningKey): Buffer {
  const privateKey: KeyObject = createPrivateKey({ key: key.privateKeyJwk, format: 'jwk' });
  const { hash } = getAlgorithm(key.privateKeyJwk);

  // ECDSA signatures use the fixed-width r||s encoding (RFC 9421 §3.3.1).
  return hash
    ? sign(hash, Buffer.from(signatureBase), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    : sign(null, Buffer.from(signatureBase), privateKey);
}

function getAlgorithm(jwk: JsonWebKey): { alg: string; hash?: string } {
  if (jwk.kty === 'EC' && jwk.crv === 'P-256') {
    return { alg: 'ES256', hash: 'sha256' };
  }

  if (jwk.kty === 'EC' && jwk.crv === 'P-384') {
    return { alg: 'ES384', hash: 'sha384' };
  }

  if (jwk.kty === 'OKP' && jwk.crv === 'Ed25519') {
    return { alg: 'EdDSA' };
  }

  throw new Error(`Unsupported UCP signing key: kty=${jwk.kty ?? '?'} crv=${jwk.crv ?? '?'}`);
}
