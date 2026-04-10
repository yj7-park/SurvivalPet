import { MonsterType, MONSTER_TINTS } from '../sprites/MonsterSprites';

export interface MonsterEntity {
  type:    MonsterType;
  worldX:  number;
  worldY:  number;
  sprite:  Phaser.GameObjects.Sprite;
  destroy(): void;
}

export function playMonsterDeathEffect(
  scene: Phaser.Scene,
  monster: MonsterEntity
): void {
  const key = `monster_${monster.type}`;
  if (scene.anims.exists(`${key}_death`)) {
    monster.sprite.play(`${key}_death`);
  }

  const tint = MONSTER_TINTS[monster.type] ?? 0x888888;
  const emitter = scene.add.particles(monster.worldX, monster.worldY, '__DEFAULT', {
    speed:    { min: 50, max: 120 },
    scale:    { start: 0.7, end: 0 },
    lifespan: 500, quantity: 12,
    tint,
    blendMode: Phaser.BlendModes.NORMAL,
  });
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());

  if (monster.type === 'golem') {
    scene.cameras.main.shake(400, 0.012);
    const flash = scene.add.rectangle(
      scene.cameras.main.width  / 2,
      scene.cameras.main.height / 2,
      scene.cameras.main.width,
      scene.cameras.main.height,
      0xff2200, 0.18
    ).setScrollFactor(0).setDepth(80);
    scene.tweens.add({
      targets: flash, alpha: 0, duration: 500,
      onComplete: () => flash.destroy(),
    });
  }

  monster.sprite.once('animationcomplete', () => {
    scene.tweens.add({
      targets: monster.sprite,
      alpha: 0,
      y:     monster.sprite.y + 8,
      duration: 600,
      onComplete: () => monster.destroy(),
    });
  });
}

export function playMonsterHurtEffect(
  scene: Phaser.Scene,
  monster: MonsterEntity
): void {
  const key = `monster_${monster.type}`;
  if (scene.anims.exists(`${key}_hurt`)) {
    monster.sprite.play(`${key}_hurt`);
  }

  monster.sprite.setTint(0xffffff);
  scene.time.delayedCall(80, () => monster.sprite.clearTint());

  const emitter = scene.add.particles(monster.worldX, monster.worldY, '__DEFAULT', {
    speed:    { min: 20, max: 60 },
    angle:    { min: -150, max: -30 },
    scale:    { start: 0.3, end: 0 },
    lifespan: 300, quantity: 5,
    tint:     0xdd2222,
  });
  emitter.setDepth(monster.sprite.depth + 1);
  emitter.explode(5);
  scene.time.delayedCall(400, () => emitter.destroy());
}
