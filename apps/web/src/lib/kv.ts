export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

export class LocalStorageKv implements KeyValueStore {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(this.scoped(key));
  }
  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(this.scoped(key), value);
  }
  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.scoped(key));
  }
  async has(key: string): Promise<boolean> {
    return localStorage.getItem(this.scoped(key)) !== null;
  }
  private scoped(key: string): string {
    return `vinylly:${key}`;
  }
}
