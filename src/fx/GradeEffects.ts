import { ItemGrade, GRADE_COLORS, GRADE_LABELS } from '../data/ItemGrade';

function spawnStarParticle(
  scene: Phaser.Scene,
  x: number, y: number,
  color: number
): void {
  const gfx = scene.add.graphics().setDepth(55);
  gfx.fillStyle(color, 1);
  const s = 3;
  gfx.fillRect(x - s / 2, y - s * 1.5, s, s * 3);
  gfx.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
  scene.tweens.add({
    targets: gfx,
    alpha: 0, y: y - 12,
    duration: 700,
    onComplete: () => gfx.destroy(),
  });
}

export function attachGroundGradeEffect(
  scene: Phaser.Scene,
  itemSprite: Phaser.GameObjects.Sprite,
  grade: ItemGrade
): void {
  if (grade === 'normal') return;
  const col  = GRADE_COLORS[grade];
  const glow = col.glow;

  const shadow = scene.add.graphics().setDepth(itemSprite.depth - 1);
  shadow.fillStyle(glow, 0.25);
  shadow.fillEllipse(itemSprite.x, itemSprite.y + 8, 28, 10);

  if (grade === 'epic' || grade === 'legendary') {
    const emitter = scene.add.particles(0, 0, '__DEFAULT', {
      follow:    itemSprite,
      speed:     { min: 10, max: 25 },
      scale:     { start: 0.5, end: 0 },
      lifespan:  800,
      frequency: grade === 'legendary' ? 80 : 160,
      tint:      glow,
      blendMode: Phaser.BlendModes.ADD,
      quantity:  1,
    });
    (itemSprite as unknown as Record<string, unknown>).__gradeEmitter = emitter;
  }

  if (grade === 'legendary') {
    scene.time.addEvent({
      delay: 1200, loop: true,
      callback: () => {
        if (!itemSprite.active) return;
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r     = 10 + Math.random() * 8;
          spawnStarParticle(
            scene,
            itemSprite.x + Math.cos(angle) * r,
            itemSprite.y + Math.sin(angle) * r,
            0xffd966
          );
        }
      },
    });
  }
}

export function playLegendaryEquipEffect(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number
): void {
  const beam = scene.add.graphics().setDepth(40).setScrollFactor(1);
  const obj  = { alpha: 0 };

  scene.tweens.add({
    targets: obj, alpha: 0.7,
    duration: 150, yoyo: true, repeat: 2,
    onUpdate: () => {
      beam.clear();
      beam.fillStyle(0xffd966, obj.alpha);
      beam.fillRect(worldX - 4, worldY - 80, 8, 80);
    },
    onComplete: () => beam.destroy(),
  });

  const emitter = scene.add.particles(worldX, worldY, '__DEFAULT', {
    speed:     { min: 60, max: 140 },
    scale:     { start: 0.8, end: 0 },
    lifespan:  600, quantity: 18,
    tint:      0xffd966,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(18);
  scene.time.delayedCall(800, () => emitter.destroy());

  const flash = scene.add.rectangle(
    scene.cameras.main.width / 2,
    scene.cameras.main.height / 2,
    scene.cameras.main.width,
    scene.cameras.main.height,
    0xffd966, 0.3
  ).setScrollFactor(0).setDepth(190);
  scene.tweens.add({
    targets: flash, alpha: 0, duration: 400,
    onComplete: () => flash.destroy(),
  });
}

export function playGradeUpEffect(
  scene: Phaser.Scene,
  itemIcon: Phaser.GameObjects.Image,
  toGrade: ItemGrade
): void {
  const col  = GRADE_COLORS[toGrade];
  const glow = col.glow;
  const hex  = col.hex;

  scene.tweens.add({
    targets: itemIcon,
    scaleX: 1.6, scaleY: 1.6,
    duration: 120, ease: 'Back.easeOut', yoyo: true,
  });

  for (let i = 0; i < 2; i++) {
    const ring = scene.add.graphics().setDepth(itemIcon.depth + 2);
    const state = { r: 6, alpha: 0.8 };

    scene.tweens.add({
      targets: state,
      r: 32 + i * 12, alpha: 0,
      delay: i * 80, duration: 380,
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(2, glow, state.alpha);
        ring.strokeCircle(itemIcon.x, itemIcon.y, state.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  const emitter = scene.add.particles(itemIcon.x, itemIcon.y, '__DEFAULT', {
    speed: { min: 40, max: 100 },
    scale: { start: 0.7, end: 0 },
    lifespan: 500, quantity: 12,
    tint: glow,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());

  const txt = scene.add.text(
    itemIcon.x, itemIcon.y - 20,
    `${GRADE_LABELS[toGrade]} 승급!`,
    { fontSize: '12px', color: hex, fontFamily: 'Courier New', fontStyle: 'bold' }
  ).setOrigin(0.5).setDepth(itemIcon.depth + 5);

  scene.tweens.add({
    targets: txt, y: itemIcon.y - 44, alpha: 0,
    duration: 900, ease: 'Quad.easeOut',
    onComplete: () => txt.destroy(),
  });
}
