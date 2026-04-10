import Phaser from 'phaser';
import { ItemRarity } from './DropSpawnEffect';

interface GlowConfig {
  innerColor: number;
  outerColor: number;
  pulseMin:   number;
  pulseMax:   number;
}

const GLOW_CONFIGS: Partial<Record<ItemRarity, GlowConfig>> = {
  uncommon: { innerColor: 0x40c040, outerColor: 0x206020, pulseMin: 0.3, pulseMax: 0.7 },
  rare:     { innerColor: 0x4080ff, outerColor: 0x203080, pulseMin: 0.4, pulseMax: 0.8 },
  epic:     { innerColor: 0xd060ff, outerColor: 0x602080, pulseMin: 0.5, pulseMax: 1.0 },
};

export function createRarityGlow(
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image,
  rarity: ItemRarity
): Phaser.GameObjects.Graphics | null {
  const cfg = GLOW_CONFIGS[rarity];
  if (!cfg) return null;

  const gfx = scene.add.graphics().setDepth(icon.depth - 0.5);

  const update = () => {
    gfx.clear();
    const t = scene.time.now / 1000;
    const pulseFactor = (Math.sin(t * 2.5) + 1) / 2;
    const alpha = cfg.pulseMin + pulseFactor * (cfg.pulseMax - cfg.pulseMin);

    gfx.fillStyle(cfg.outerColor, alpha * 0.4);
    gfx.fillCircle(icon.x, icon.y, 14);
    gfx.fillStyle(cfg.innerColor, alpha * 0.6);
    gfx.fillCircle(icon.x, icon.y, 8);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  icon.on(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    gfx.destroy();
  });

  return gfx;
}

export function createEpicIdleParticles(
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image
): void {
  const emitter = scene.add.particles(icon.x, icon.y, 'fx_pixel', {
    tint:    [0xd060ff, 0xff80ff, 0xffffff],
    speed:   { min: 10, max: 30 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 0.6, end: 0 },
    alpha:   { start: 0.8, end: 0 },
    lifespan: { min: 500, max: 900 },
    frequency: 200,
    blendMode: Phaser.BlendModes.ADD
  });
  emitter.setDepth(icon.depth + 1);

  const updatePos = () => emitter.setPosition(icon.x, icon.y - 4);
  scene.events.on(Phaser.Scenes.Events.UPDATE, updatePos);
  icon.on(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, updatePos);
    emitter.destroy();
  });
}
