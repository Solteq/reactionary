import type { RequestContext } from '../../../schemas/session.schema.js';
import { makeInitializer } from '../../core/initializer.js';
import { mergeDefsFor } from '../../core/provider.js';
import { cartCapability } from './cart.js';
import { productCapability } from './product.js';

const merge = mergeDefsFor<RequestContext>();
export const providerFooCapabilities = merge(productCapability, cartCapability);
export const providerFooInitializer = makeInitializer(providerFooCapabilities);
