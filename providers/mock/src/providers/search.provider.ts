import {
    SearchIdentifier,
    SearchProvider,
    SearchResult,
  } from '@reactionary/core';
import { MockConfig } from '../core/configuration';
  
  export class MockSearchProvider<
    T extends SearchResult
  > extends SearchProvider<T> {
    protected config: MockConfig;
  
    constructor(config: MockConfig) {
      super();
  
      this.config = config;
    }
  
    public async get(identifier: SearchIdentifier): Promise<T> {
        return undefined as any;
    }
}