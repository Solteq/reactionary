import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair, type JWK, type JWTPayload } from 'jose';

export type FakeIdTokenTamper = 'signature' | 'audience' | 'issuer' | 'nonce' | 'expired';

export type FakeApproval = {
  claims?: JWTPayload;
  /** Makes the issued ID token invalid in one specific way. */
  tamper?: FakeIdTokenTamper;
};

type IssuedCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
  approval: FakeApproval;
};

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

const KEY_ID = 'fake-idp-key';

/**
 * A local OpenID Connect provider for tests: discovery, JWKS, token endpoint, and signed ID tokens. The shopper's
 * trip through the provider is simulated by approve(), which returns the callback URL the browser would be sent to.
 */
export class FakeOidcProvider {
  readonly clientId = 'test-client';
  readonly clientSecret = 'test-secret';
  failTokenEndpoint = false;
  omitAccessToken = false;
  /** Refresh tokens the provider has issued and not yet seen refused. */
  refreshCalls = 0;
  rotateRefreshToken = false;
  /** Advertised as token_endpoint_auth_methods_supported and enforced when set: the one way clients may authenticate. */
  tokenEndpointAuthMethods: Array<'client_secret_basic' | 'client_secret_post'> | undefined;
  /** Serves a userinfo endpoint (and advertises it) with these claims, on top of sub; undefined means no endpoint. */
  userinfoClaims: JWTPayload | undefined;
  /** Makes the userinfo endpoint answer for another subject than the ID token's. */
  userinfoSubMismatch = false;
  /** Omits these claims from issued ID tokens, e.g. email, so that a client has to ask userinfo for them. */
  omitIdTokenClaims: string[] = [];

  private readonly codes = new Map<string, IssuedCode>();
  private constructor(
    private readonly server: Server,
    private readonly signingKey: SigningKey,
    private readonly otherKey: SigningKey,
    private readonly jwk: JWK,
    readonly issuer: string,
  ) {}

  static async start(): Promise<FakeOidcProvider> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const other = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };

    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const provider = new FakeOidcProvider(server, privateKey, other.privateKey, jwk, `http://127.0.0.1:${port}`);
    server.on('request', (req, res) => {
      void provider.handle(req.method ?? 'GET', req.url ?? '/', req, res);
    });
    return provider;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  /**
   * What the identity provider does when the shopper opens the authorization URL and signs in: remember the
   * request and return the callback URL, with code and state, the browser is redirected to.
   */
  approve(authorizationUrl: string, approval: FakeApproval = {}): string {
    const url = new URL(authorizationUrl);
    const params = url.searchParams;
    if (url.origin !== this.issuer || url.pathname !== '/authorize') {
      throw new Error(`Not an authorization URL of this provider: ${authorizationUrl}`);
    }
    if (params.get('code_challenge_method') !== 'S256' || params.get('response_type') !== 'code') {
      throw new Error('The authorization request must use the code flow with PKCE S256');
    }
    const code = `code-${this.codes.size + 1}`;
    this.codes.set(code, {
      clientId: params.get('client_id') ?? '',
      redirectUri: params.get('redirect_uri') ?? '',
      codeChallenge: params.get('code_challenge') ?? '',
      nonce: params.get('nonce') ?? '',
      approval: { claims: approval.claims ?? {}, ...(approval.tamper ? { tamper: approval.tamper } : {}) },
    });
    const callback = new URL(params.get('redirect_uri') ?? '');
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', params.get('state') ?? '');
    return callback.toString();
  }

  private async idToken(issued: IssuedCode): Promise<string> {
    const tamper = issued.approval.tamper;
    const now = Math.floor(Date.now() / 1000);
    const claims: JWTPayload = {
      sub: 'user-1',
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada Lovelace',
      given_name: 'Ada',
      family_name: 'Lovelace',
      ...issued.approval.claims,
      nonce: tamper === 'nonce' ? 'someone-elses-nonce' : issued.nonce,
    };
    for (const name of this.omitIdTokenClaims) {
      delete claims[name];
    }
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setIssuer(tamper === 'issuer' ? 'https://evil.example' : this.issuer)
      .setAudience(tamper === 'audience' ? 'another-client' : issued.clientId)
      .setIssuedAt(tamper === 'expired' ? now - 7200 : now)
      .setExpirationTime(tamper === 'expired' ? now - 3600 : now + 300)
      .sign(tamper === 'signature' ? this.otherKey : this.signingKey);
  }

  /** Rejects a token request that authenticates in a way the provider does not allow (when restricted) or with the wrong secret. */
  private clientAuthenticatesCorrectly(form: URLSearchParams, authorization: string | undefined): boolean {
    const [scheme, encoded] = (authorization ?? '').split(' ');
    const usesBasic = scheme?.toLowerCase() === 'basic';
    if (usesBasic) {
      const [id, secret] = Buffer.from(encoded ?? '', 'base64').toString('utf8').split(':');
      if (decodeURIComponent(id ?? '') !== this.clientId || decodeURIComponent(secret ?? '') !== this.clientSecret) {
        return false;
      }
    }
    if (this.tokenEndpointAuthMethods) {
      const usesPost = form.has('client_secret');
      const allowed = (usesBasic && this.tokenEndpointAuthMethods.includes('client_secret_basic')) ||
        (usesPost && this.tokenEndpointAuthMethods.includes('client_secret_post'));
      return allowed;
    }
    return true;
  }

  private async handle(
    method: string,
    path: string,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };

    if (path === '/.well-known/openid-configuration') {
      return send(200, {
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
        end_session_endpoint: `${this.issuer}/logout`,
        ...(this.userinfoClaims ? { userinfo_endpoint: `${this.issuer}/userinfo` } : {}),
        ...(this.tokenEndpointAuthMethods ? { token_endpoint_auth_methods_supported: this.tokenEndpointAuthMethods } : {}),
      });
    }
    if (path === '/userinfo' && this.userinfoClaims) {
      if (req.headers.authorization !== 'Bearer access-token') {
        return send(401, { error: 'invalid_token' });
      }
      return send(200, { sub: this.userinfoSubMismatch ? 'someone-else' : 'user-1', ...this.userinfoClaims });
    }
    if (path === '/jwks') {
      return send(200, { keys: [this.jwk] });
    }
    if (path === '/token' && method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      if (!this.clientAuthenticatesCorrectly(form, req.headers.authorization)) {
        return send(401, { error: 'invalid_client' });
      }
      if (form.get('grant_type') === 'refresh_token') {
        this.refreshCalls += 1;
        if (this.failTokenEndpoint || form.get('refresh_token') !== 'refresh-token' || (form.get('client_id') ?? this.clientId) !== this.clientId) {
          return send(400, { error: 'invalid_grant' });
        }
        return send(200, {
          token_type: 'Bearer',
          access_token: `access-token-${this.refreshCalls + 1}`,
          expires_in: 300,
          ...(this.rotateRefreshToken ? { refresh_token: 'refresh-token' } : {}),
        });
      }
      const issued = this.codes.get(form.get('code') ?? '');
      this.codes.delete(form.get('code') ?? '');
      const challenge = createHash('sha256')
        .update(form.get('code_verifier') ?? '')
        .digest('base64url');
      if (
        this.failTokenEndpoint ||
        !issued ||
        (form.get('client_id') ?? issued.clientId) !== issued.clientId ||
        form.get('redirect_uri') !== issued.redirectUri ||
        challenge !== issued.codeChallenge ||
        (form.has('client_secret') && form.get('client_secret') !== this.clientSecret)
      ) {
        return send(400, { error: 'invalid_grant' });
      }
      return send(200, {
        token_type: 'Bearer',
        ...(this.omitAccessToken ? {} : { access_token: 'access-token' }),
        refresh_token: 'refresh-token',
        expires_in: 300,
        id_token: await this.idToken(issued),
      });
    }
    send(404, { error: 'not_found' });
  }
}
