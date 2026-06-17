import type { OperationalMemory, OperationalMemoryType } from "@clarityloop/core";

export interface MemoryRepository {
  put(mem: OperationalMemory): Promise<void>;
  get(id: string): Promise<OperationalMemory | null>;
  query(q: { scope?: string; type?: OperationalMemoryType; entity?: string }): Promise<OperationalMemory[]>;
  invalidate(id: string): Promise<void>; // TTL / conflict invalidation (memo §16)
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly map = new Map<string, OperationalMemory>();

  async put(mem: OperationalMemory): Promise<void> {
    this.map.set(mem.id, mem);
  }

  async get(id: string): Promise<OperationalMemory | null> {
    return this.map.get(id) ?? null;
  }

  async query(q: { scope?: string; type?: OperationalMemoryType; entity?: string }): Promise<OperationalMemory[]> {
    return [...this.map.values()].filter((m) => {
      if (q.scope !== undefined && m.scope !== q.scope) return false;
      if (q.type !== undefined && m.type !== q.type) return false;
      if (q.entity !== undefined) {
        if (m.type !== "CustomerPreference" || m.entity !== q.entity) return false;
      }
      return true;
    });
  }

  async invalidate(id: string): Promise<void> {
    this.map.delete(id);
  }
}
