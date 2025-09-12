import {
  AnalyticsProvider,
  BaseModel,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';

export class FakeAnalyticsProvider<
  T extends BaseModel = BaseModel
> extends AnalyticsProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: any) {
    super(schema, cache);

    this.config = config;
  }
}