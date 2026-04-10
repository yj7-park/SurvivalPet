import Phaser from 'phaser';
import { FogOfWarSystem } from './FogOfWarSystem';

type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type TimeOfDay = 'day' | 'evening' | 'night' | 'dawn';

const FOG_ALPHA_SEASON: Record<Season, number> = {
  spring: 0.92,
  summer: 0.90,
  autumn: 0.88,
  winter: 0.95,
};

export class FogLayer {
  private darkFog: Phaser.GameObjects.RenderTexture;
  private dimFog:  Phaser.GameObjects.RenderTexture;
  private readonly TILE = 32;
  private readonly RT_W: number;
  private readonly RT_H: number;
  private dirty = true;
  private lastPlayerTX = -999;
  private lastPlayerTY = -999;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cam = scene.cameras.main;
    this.RT_W = cam.width  + this.TILE * 4;
    this.RT_H = cam.height + this.TILE * 4;

    this.darkFog = scene.add.renderTexture(0, 0, this.RT_W, this.RT_H)
      .setDepth(60)
      .setScrollFactor(0);

    this.dimFog = scene.add.renderTexture(0, 0, this.RT_W, this.RT_H)
      .setDepth(59)
      .setScrollFactor(0);
  }

  updateIfNeeded(
    playerTX: number, playerTY: number,
    fog: FogOfWarSystem,
    cam: Phaser.Cameras.Scene2D.Camera,
    season: Season = 'spring'
  ): void {
    if (playerTX === this.lastPlayerTX && playerTY === this.lastPlayerTY && !this.dirty) {
      this.syncPosition(cam);
      return;
    }
    this.lastPlayerTX = playerTX;
    this.lastPlayerTY = playerTY;
    this.dirty = false;
    this.render(fog, cam, season);
  }

  private render(
    fog: FogOfWarSystem,
    cam: Phaser.Cameras.Scene2D.Camera,
    season: Season
  ): void {
    const startTX = Math.floor(cam.scrollX / this.TILE) - 2;
    const startTY = Math.floor(cam.scrollY / this.TILE) - 2;
    const endTX   = startTX + Math.ceil(this.RT_W / this.TILE) + 4;
    const endTY   = startTY + Math.ceil(this.RT_H / this.TILE) + 4;

    const darkAlpha = FOG_ALPHA_SEASON[season] ?? 0.92;

    // Dark fog (unexplored)
    this.darkFog.clear();
    const darkGfx = this.scene.make.graphics({});
    darkGfx.fillStyle(0x000000, 1.0);
    darkGfx.fillRect(0, 0, this.RT_W, this.RT_H);
    this.darkFog.draw(darkGfx, 0, 0);
    darkGfx.destroy();
    this.darkFog.setAlpha(darkAlpha);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (fog.isVisited(tx, ty)) {
          const sx = (tx - startTX) * this.TILE + 16;
          const sy = (ty - startTY) * this.TILE + 16;
          this.eraseCircleGradient(this.darkFog, sx, sy, this.TILE * 1.5);
        }
      }
    }

    // Dim fog (visited but not visible)
    this.dimFog.clear();
    const dimGfx = this.scene.make.graphics({});
    dimGfx.fillStyle(0x000000, 1.0);
    dimGfx.fillRect(0, 0, this.RT_W, this.RT_H);
    this.dimFog.draw(dimGfx, 0, 0);
    dimGfx.destroy();
    this.dimFog.setAlpha(0.45);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (fog.isVisible(tx, ty)) {
          const sx = (tx - startTX) * this.TILE + 16;
          const sy = (ty - startTY) * this.TILE + 16;
          this.eraseCircleGradient(this.dimFog, sx, sy, this.TILE * 2.0);
        }
      }
    }

    this.syncPosition(cam);
  }

  private eraseCircleGradient(
    rt: Phaser.GameObjects.RenderTexture,
    cx: number, cy: number, r: number
  ): void {
    const gfx = this.scene.make.graphics({});
    gfx.fillStyle(0x000000, 1.0);
    gfx.fillCircle(cx, cy, r * 0.5);
    gfx.fillStyle(0x000000, 0.75);
    gfx.fillCircle(cx, cy, r * 0.75);
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillCircle(cx, cy, r);
    rt.erase(gfx, 0, 0);
    gfx.destroy();
  }

  private syncPosition(cam: Phaser.Cameras.Scene2D.Camera): void {
    const offsetX = -(cam.scrollX % this.TILE) - this.TILE * 2;
    const offsetY = -(cam.scrollY % this.TILE) - this.TILE * 2;
    this.darkFog.setPosition(offsetX, offsetY);
    this.dimFog.setPosition(offsetX, offsetY);
  }

  setIndoor(indoor: boolean): void {
    const darkTarget = indoor ? 0 : 0.92;
    const dimTarget  = indoor ? 0 : 0.45;
    this.scene.tweens.add({
      targets: this.darkFog, alpha: darkTarget, duration: 300
    });
    this.scene.tweens.add({
      targets: this.dimFog, alpha: dimTarget, duration: 300
    });
  }

  markDirty(): void {
    this.dirty = true;
  }

  destroy(): void {
    this.darkFog.destroy();
    this.dimFog.destroy();
  }
}
