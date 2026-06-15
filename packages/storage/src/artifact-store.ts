export interface ArtifactStore {
  put(key: string, body: string): Promise<void>;
  get(key: string): Promise<string | null>;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly map = new Map<string, string>();
  async put(key: string, body: string): Promise<void> {
    this.map.set(key, body);
  }
  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
}
