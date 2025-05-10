export class InMemoryCache {
  private cache: Map<string, { value: unknown; expiration: number }>;
  private capacity: number;
  private evictionTime: number;

  constructor(capacity: number, evictionTime: number) {
    this.capacity = capacity;
    this.evictionTime = evictionTime;
    this.cache = new Map();

    console.log('rebuild?!');
  }

  get(key: string): any | null {
    console.log('get by key: ', key);

    if (!this.cache.has(key)) {
      return null;
    }

    const { value, expiration } = this.cache.get(key)!;

    console.log('value, expiration: ', value, expiration);

    if (Date.now() > expiration) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, { value, expiration });

    return value;
  }

  put(key: string, value: any): void {
    console.log('put by key: ', key);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const expiration = Date.now() + this.evictionTime;
    this.cache.set(key, { value, expiration });
  }
}
