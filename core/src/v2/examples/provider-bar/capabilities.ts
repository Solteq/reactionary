import type { RequestContext } from '../../../schemas/session.schema.js';
import { makeInitializer } from '../../core/initializer.js';
import { mergeDefsFor } from '../../core/provider.js';
import { categoryCapability } from './category.js';

const merge = mergeDefsFor<RequestContext>();
export const providerBarCapabilities = merge(categoryCapability);
export const providerBarInitializer = makeInitializer(providerBarCapabilities);
