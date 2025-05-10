import {
    SearchIdentifier,
    SearchProvider,
    SearchResult,
  } from '@reactionary/core';
import { FakeConfig } from '../core/configuration';
import z from 'zod';
  
  export class FakeSearchProvider<
    T extends SearchResult
  > extends SearchProvider<T> {
    protected config: FakeConfig;
  
    constructor(config: FakeConfig, schema: z.ZodType<T>) {
      super(schema);
  
      this.config = config;
    }
  
    public async get(identifier: SearchIdentifier): Promise<T> {
        return undefined as any;
    }
}