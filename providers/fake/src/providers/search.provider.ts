import {
    SearchIdentifier,
    SearchProvider,
    SearchResult,
  } from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
  
  export class FakeSearchProvider<
    T extends SearchResult
  > extends SearchProvider<T> {
    protected config: FakeConfiguration;
  
    constructor(config: FakeConfiguration, schema: z.ZodType<T>) {
      super(schema);
  
      this.config = config;
    }
  
    public async get(identifier: SearchIdentifier): Promise<T> {
        return undefined as any;
    }
}