import Phaser from 'phaser';
import { TILE_SIZE } from '../world/MapGenerator';

/**
 * Draws and manages the indoor warm overlay and roof inner shadows.
 * Overlay is redrawn whenever the covered tile set changes.
 */
export class IndoorRenderer {
  private overlayGfx: Phaser.GameObjects.Graphics;
  private shadowGfx: Phaser.GameObjects.Graphics;
  private isIndoor = false;
  private hasCampfire = false;

  constructor(private scene: Phaser.Scene) {
    this.overlayGfx = scene.add.graphics().setScrollFactor(1).setDepth(3.5).setAlpha(0);
    this.shadowGfx  = scene.add.graphics().setScrollFactor(1).setDepth(3.6).setAlpha(0);
  }

  /**
   * Redraw the warm overlay for a new tile coverage set.
   * Call this when roofs are added or removed.
   */
  refresh(coveredTiles: Set<string>): void {
    this.overlayGfx.clear();
    this.shadowGfx.clear();

    if (coveredTiles.size === 0) return;

    // Warm amber fill per tile
    this.overlayGfx.fillStyle(0xffcc88, 0.07);
    coveredTiles.forEach(key => {
      const [tx, ty] = key.split(',').map(Number);
      this.overlayGfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });

    // Inner shadow: rough AABB of covered tiles
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    coveredTiles.forEach(key => {
      const [tx, ty] = key.split(',').map(Number);
      if (tx < minX) minX = tx;
      if (ty < minY) minY = ty;
      if (tx > maxX) maxX = tx;
      if (ty > maxY) maxY = ty;
    });

    if (minX !== Infinity) {
      const px = minX * TILE_SIZE;
      const py = minY * TILE_SIZE;
      const pw = (maxX - minX + 1) * TILE_SIZE;
      const ph = (maxY - minY + 1) * TILE_SIZE;

      this.shadowGfx.fillStyle(0x000000, 0.12);
      this.shadowGfx.fillRect(px, py, pw, 8);            // top
      this.shadowGfx.fillRect(px, py, 8, ph);            // left
      this.shadowGfx.fillRect(px + pw - 8, py, 8, ph);   // right
    }

    this.updateAlpha();
  }

  /** Call when player enters or leaves a roofed area. */
  setIndoor(indoor: boolean, hasCampfire: boolean): void {
    this.isIndoor = indoor;
    this.hasCampfire = hasCampfire;
    this.updateAlpha();
  }

  /** Update campfire presence (affects overlay warmth). */
  setHasCampfire(hasCampfire: boolean): void {
    this.hasCampfire = hasCampfire;
    if (this.isIndoor) this.updateAlpha();
  }

  private updateAlpha(): void {
    if (!this.isIndoor) {
      this.overlayGfx.setAlpha(0);
      this.shadowGfx.setAlpha(0);
      return;
    }
    const warmAlpha = this.hasCampfire ? 0.10 : 0.06;
    this.overlayGfx.setAlpha(warmAlpha / 0.07);  // scale from base fill alpha
    this.shadowGfx.setAlpha(1);
  }

  destroy(): void {
    this.overlayGfx.destroy();
    this.shadowGfx.destroy();
  }
}
