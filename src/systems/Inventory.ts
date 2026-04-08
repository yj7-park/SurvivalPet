export interface ItemStack {
  key: string;
  count: number;
}

export class Inventory {
  private items = new Map<string, number>();

  add(key: string, count: number): void {
    this.items.set(key, (this.items.get(key) ?? 0) + count);
  }

  remove(key: string, count: number): boolean {
    const have = this.items.get(key) ?? 0;
    if (have < count) return false;
    const next = have - count;
    if (next === 0) this.items.delete(key);
    else this.items.set(key, next);
    return true;
  }

  has(key: string, count = 1): boolean {
    return (this.items.get(key) ?? 0) >= count;
  }

  get(key: string): number {
    return this.items.get(key) ?? 0;
  }

  getAll(): ItemStack[] {
    return Array.from(this.items.entries()).map(([key, count]) => ({ key, count }));
  }
}
