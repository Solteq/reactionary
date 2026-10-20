import { describe, expect, it } from 'vitest';
import {
  MagentoApiError,
  formatMagentoMessage,
  parseMagentoRestErrorBody,
  type MagentoApiErrorDetails,
} from '../core/errors.js';
import {
  handleMagentoProviderError,
  isMagentoNotFoundError,
  toMagentoProviderError,
} from '../utils/magento-errors.js';

function restError(status: number, magentoMessage?: string): MagentoApiError {
  return new MagentoApiError({
    transport: 'rest',
    status,
    method: 'GET',
    url: 'https://shop.example.com/rest/default/V1/carts/mine',
    magentoMessage,
  });
}

function graphqlError(category: string): MagentoApiError {
  const details: MagentoApiErrorDetails = {
    transport: 'graphql',
    status: 200,
    method: 'POST',
    url: 'https://shop.example.com/graphql',
    graphqlErrors: [{ message: `failed with ${category}`, extensions: { category } }],
  };
  return new MagentoApiError(details);
}

describe('toMagentoProviderError', () => {
  it('maps a REST 404 to NotFound with the identifier', () => {
    expect(toMagentoProviderError('get order', restError(404), { key: '5' })).toEqual({
      type: 'NotFound',
      identifier: { key: '5' },
    });
  });

  it('maps graphql-no-such-entity to NotFound', () => {
    expect(toMagentoProviderError('get company', graphqlError('graphql-no-such-entity'), 'c-1')).toEqual({
      type: 'NotFound',
      identifier: 'c-1',
    });
  });

  it('maps a REST 400 to InvalidInput with the Magento message', () => {
    expect(toMagentoProviderError('add item', restError(400, 'The requested qty is not available'))).toEqual({
      type: 'InvalidInput',
      error: 'The requested qty is not available',
    });
  });

  it('maps graphql-input and graphql-already-exists to InvalidInput', () => {
    expect(toMagentoProviderError('create', graphqlError('graphql-input'))).toEqual({
      type: 'InvalidInput',
      error: 'failed with graphql-input',
    });
    expect(toMagentoProviderError('create', graphqlError('graphql-already-exists'))).toMatchObject({
      type: 'InvalidInput',
    });
  });

  it('keeps auth failures Generic', () => {
    expect(toMagentoProviderError('get me', restError(401, 'Not authorized'))).toEqual({
      type: 'Generic',
      message: 'Failed to get me: Not authorized',
    });
    expect(toMagentoProviderError('get me', restError(403))).toMatchObject({ type: 'Generic' });
    expect(toMagentoProviderError('get me', graphqlError('graphql-authorization'))).toMatchObject({
      type: 'Generic',
    });
  });

  it('maps server errors, plain errors and unknown values to Generic', () => {
    expect(toMagentoProviderError('load', restError(500, 'Boom'))).toEqual({
      type: 'Generic',
      message: 'Failed to load: Boom',
    });
    expect(toMagentoProviderError('load', new Error('network down'))).toEqual({
      type: 'Generic',
      message: 'Failed to load: network down',
    });
    expect(toMagentoProviderError('load', 42)).toEqual({
      type: 'Generic',
      message: 'Failed to load: Unknown error',
    });
  });
});

describe('handleMagentoProviderError', () => {
  it('returns a failed Result instead of throwing', () => {
    const result = handleMagentoProviderError('get order', restError(404), { key: '5' });

    expect(result.success).toBe(false);
    expect(result.error).toEqual({ type: 'NotFound', identifier: { key: '5' } });
  });
});

describe('isMagentoNotFoundError', () => {
  it('recognises REST and GraphQL not-found failures only', () => {
    expect(isMagentoNotFoundError(restError(404))).toBe(true);
    expect(isMagentoNotFoundError(graphqlError('graphql-no-such-entity'))).toBe(true);
    expect(isMagentoNotFoundError(restError(400))).toBe(false);
    expect(isMagentoNotFoundError(new Error('404'))).toBe(false);
  });
});

describe('Magento REST error bodies', () => {
  it('substitutes positional and named parameters', () => {
    expect(formatMagentoMessage('Product "%1" in "%2"', ['SKU-1', 'b2c'])).toBe('Product "SKU-1" in "b2c"');
    expect(formatMagentoMessage('No such entity with %fieldName = %fieldValue', { fieldName: 'id', fieldValue: 3 })).toBe(
      'No such entity with id = 3',
    );
  });

  it('ignores bodies that are not Magento JSON errors', () => {
    expect(parseMagentoRestErrorBody('<html>Bad gateway</html>')).toEqual({});
    expect(parseMagentoRestErrorBody('')).toEqual({});
    expect(parseMagentoRestErrorBody('{"foo":1}')).toEqual({});
  });
});
