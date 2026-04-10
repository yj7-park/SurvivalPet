import Phaser from 'phaser';

const SKINS = 3;
const DIRS = ['down', 'up', 'left'] as const;

// Spritesheet row × col → frame index
// 128×96px sheet: 4 cols × 3 rows, each 32×32
// Row 0=down, Row 1=up, Row 2=left
// Col 0=idle, Col 1-3=walk frames
// Right direction = left row with flipX

export class AnimationManager {
  static register(scene: Phaser.Scene): void {
    for (let skin = 0; skin < SKINS; skin++) {
      const key = `char_skin${skin}`;
      for (let row = 0; row < DIRS.length; row++) {
        const dir = DIRS[row];
        const base = row * 4; // frame index offset for this row
        // Idle: single frame at col 0
        scene.anims.create({
          key: `idle_${skin}_${dir}`,
          frames: scene.anims.generateFrameNumbers(key, { frames: [base] }),
          frameRate: 1,
          repeat: -1,
        });
        // Walk: 4-frame cycle [col1, col2, col3, col2]
        scene.anims.create({
          key: `walk_${skin}_${dir}`,
          frames: scene.anims.generateFrameNumbers(key, {
            frames: [base + 1, base + 2, base + 3, base + 2],
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    // Water ripple animation
    scene.anims.create({
      key: 'water_ripple',
      frames: scene.anims.generateFrameNumbers('tile_water_anim', { start: 0, end: 3 }),
      frameRate: 3,
      repeat: -1,
      yoyo: true,
    });

    // Enemy animations (sheet layout: row0=front idle/walk1/walk2/attack, row1=left, row2=death×4)
    for (const type of ['enemy_wolf', 'enemy_tiger', 'enemy_raider', 'enemy_raider_boss']) {
      const prefix = type.replace('enemy_', '').replace('_', '');
      scene.anims.create({
        key: `${prefix}_idle`,
        frames: [{ key: type, frame: 0 }],
        frameRate: 2,
        repeat: -1,
      });
      scene.anims.create({
        key: `${prefix}_walk`,
        frames: [{ key: type, frame: 1 }, { key: type, frame: 2 }],
        frameRate: 7,
        repeat: -1,
      });
      scene.anims.create({
        key: `${prefix}_attack`,
        frames: [{ key: type, frame: 3 }, { key: type, frame: 0 }],
        frameRate: 8,
        repeat: 0,
      });
      scene.anims.create({
        key: `${prefix}_die`,
        frames: scene.anims.generateFrameNumbers(type, { start: 8, end: 11 }),
        frameRate: 6,
        repeat: 0,
      });
    }
  }
}
