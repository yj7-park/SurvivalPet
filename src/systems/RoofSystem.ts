/** Tracks which tiles are covered by a roof (3×3 area per roof structure). */
export class RoofSystem {
  // "tileX,tileY" → number of roofs covering this tile (for overlapping roofs)
  private coverage = new Map<string, number>();

  addRoof(cx: number, cy: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${cx + dx},${cy + dy}`;
        this.coverage.set(key, (this.coverage.get(key) ?? 0) + 1);
      }
    }
  }

  removeRoof(cx: number, cy: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${cx + dx},${cy + dy}`;
        const count = (this.coverage.get(key) ?? 0) - 1;
        if (count <= 0) this.coverage.delete(key);
        else this.coverage.set(key, count);
      }
    }
  }

  isCovered(tileX: number, tileY: number): boolean {
    return this.coverage.has(`${tileX},${tileY}`);
  }

  getCoveredSet(): Set<string> {
    return new Set(this.coverage.keys());
  }

  clear(): void {
    this.coverage.clear();
  }
}
