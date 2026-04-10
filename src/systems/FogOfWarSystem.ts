export class FogOfWarSystem {
  private visitedTiles = new Set<string>();
  private visibleTiles = new Set<string>();

  private readonly EXPLORE_RADIUS = 5;
  private readonly VISIBLE_RADIUS = 4;

  markVisible(playerTX: number, playerTY: number): void {
    this.visibleTiles.clear();
    const er = this.EXPLORE_RADIUS;
    const vr = this.VISIBLE_RADIUS;

    for (let dy = -er; dy <= er; dy++) {
      for (let dx = -er; dx <= er; dx++) {
        if (dx * dx + dy * dy <= er * er) {
          const key = `${playerTX + dx},${playerTY + dy}`;
          this.visitedTiles.add(key);
          if (dx * dx + dy * dy <= vr * vr) {
            this.visibleTiles.add(key);
          }
        }
      }
    }
  }

  isVisited(tx: number, ty: number): boolean {
    return this.visitedTiles.has(`${tx},${ty}`);
  }

  isVisible(tx: number, ty: number): boolean {
    return this.visibleTiles.has(`${tx},${ty}`);
  }

  getVisitedCount(): number {
    return this.visitedTiles.size;
  }

  serialize(): string[] {
    return Array.from(this.visitedTiles);
  }

  deserialize(data: string[]): void {
    this.visitedTiles = new Set(data);
  }
}
