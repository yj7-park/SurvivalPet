import Phaser from 'phaser';
import { Season } from '../systems/GameTime';

const TILE = 32;
const TREE_OVERHANG = 16;

const TREE_SEASON_FRAME: Record<Season, number> = {
  spring: 0,
  summer: 1,
  autumn: 2,
  winter: 3,
};

const LEAF_FALL_COLORS: Record<Season, number[]> = {
  spring: [0x5aaa30, 0x7acc48, 0x48921e],
  summer: [0x2a7a18, 0x48a030, 0x1e6010],
  autumn: [0xc86010, 0xe88030, 0xa04808, 0xdd6020, 0xf0a030],
  winter: [0xe8f0f8, 0xc0ccd8],
};

export class TreeRenderer {
  private scene: Phaser.Scene;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private currentSeason: Season = 'spring';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  addTree(tx: number, ty: number, season: Season): void {
    const key = `${tx},${ty}`;
    const frame = TREE_SEASON_FRAME[season] ?? 0;
    const sprite = this.scene.add.sprite(
      tx * TILE,
      ty * TILE - TREE_OVERHANG,
      'obj_tree_seasons',
      frame,
    )
      .setOrigin(0, 0)
      .setDepth((ty + 1) * TILE);
    this.sprites.set(key, sprite);
  }

  removeTree(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    this.sprites.get(key)?.destroy();
    this.sprites.delete(key);
  }

  removeTreeWithFall(
    tx: number,
    ty: number,
    playerX: number,
    season: Season,
  ): void {
    const key = `${tx},${ty}`;
    const sprite = this.sprites.get(key);
    if (!sprite) return;

    this.sprites.delete(key);

    const treeWx = tx * TILE + TILE / 2;
    const fallDir = playerX < treeWx ? 'right' : 'left';

    this.scene.tweens.add({
      targets: sprite,
      angle: fallDir === 'right' ? 90 : -90,
      x: sprite.x + (fallDir === 'right' ? 20 : -20),
      y: sprite.y + 14,
      scaleY: 0.7,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        const fx = sprite.x;
        const fy = sprite.y;
        sprite.destroy();
        this.spawnFallParticles(fx, fy, fallDir, season);
      },
    });
  }

  private spawnFallParticles(
    x: number,
    y: number,
    dir: 'left' | 'right',
    season: Season,
  ): void {
    const colors = LEAF_FALL_COLORS[season] ?? LEAF_FALL_COLORS.spring;
    const dirMult = dir === 'right' ? 1 : -1;

    for (let i = 0; i < 25; i++) {
      const angleDeg = Phaser.Math.Between(0, 60) * dirMult;
      const speed = Phaser.Math.Between(40, 120);
      const color = Phaser.Utils.Array.GetRandom(colors) as number;
      const leaf = this.scene.add.rectangle(x, y, 4, 3, color);
      leaf.setDepth(9999);

      this.scene.tweens.add({
        targets: leaf,
        x: leaf.x + Math.cos(Phaser.Math.DegToRad(angleDeg)) * speed,
        y: leaf.y + Math.sin(Phaser.Math.DegToRad(angleDeg)) * speed + 30,
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        ease: 'Quad.easeOut',
        onComplete: () => leaf.destroy(),
      });
    }
  }

  onSeasonChanged(season: Season): void {
    this.currentSeason = season;
    const frame = TREE_SEASON_FRAME[season] ?? 0;
    this.sprites.forEach(sprite => sprite.setFrame(frame));
  }

  startRegrowAnimation(tx: number, ty: number, season: Season): void {
    const key = `${tx},${ty}`;
    // Create seedling first, then grow into tree
    const wx = tx * TILE;
    const wy = ty * TILE - TREE_OVERHANG;
    const frame = TREE_SEASON_FRAME[season] ?? 0;
    const sprite = this.scene.add.sprite(wx, wy, 'obj_tree_seasons', frame)
      .setOrigin(0, 0)
      .setDepth((ty + 1) * TILE)
      .setScale(0.1)
      .setAlpha(0.4);
    this.sprites.set(key, sprite);

    const stages = [
      { scale: 0.1, alpha: 0.4, duration: 2000 },
      { scale: 0.4, alpha: 0.7, duration: 3000 },
      { scale: 0.8, alpha: 0.9, duration: 3000 },
      { scale: 1.0, alpha: 1.0, duration: 2000 },
    ];
    let delay = 0;
    stages.forEach(stage => {
      this.scene.tweens.add({
        targets: sprite,
        scaleX: stage.scale,
        scaleY: stage.scale,
        alpha: stage.alpha,
        duration: stage.duration,
        delay,
        ease: 'Quad.easeOut',
      });
      delay += stage.duration;
    });
  }

  clearAll(): void {
    this.sprites.forEach(s => s.destroy());
    this.sprites.clear();
  }

  destroy(): void {
    this.clearAll();
  }
}
