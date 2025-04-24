export class Cache {
  public entries = new Map<string, unknown>();

  public get(key: string) {
    return this.entries.get(key);
  }

  public persist(key: string, entry: unknown) {
    this.entries.set(key, entry);
  }
}
