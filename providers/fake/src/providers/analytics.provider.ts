import type {
  BaseModel,
  Cache,
  RequestContext} from '@reactionary/core';
import {
  AnalyticsProvider
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeAnalyticsProvider<
  T extends BaseModel = BaseModel
> extends AnalyticsProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }
}