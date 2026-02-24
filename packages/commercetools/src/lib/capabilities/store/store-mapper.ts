import type {
  FulfillmentCenterIdentifier,
  Store,
  StoreIdentifier,
} from '@reactionary/core';
import type { Channel } from '@commercetools/platform-sdk';

export function parseCommercetoolsStore(body: Channel): Store {
  let name = '';
  if (body.name && body.name['la']) {
    name = body.name['la'];
  }

  const identifier = {
    key: body.key,
  } satisfies StoreIdentifier;

  const fulfillmentCenter = {
    key: body.key,
  } satisfies FulfillmentCenterIdentifier;

  return {
    identifier,
    fulfillmentCenter,
    name,
  } satisfies Store;
}
