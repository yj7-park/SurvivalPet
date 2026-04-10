import {
  MonsterType, MONSTER_FRAME_SIZE, MONSTER_ANIM_LAYOUT,
  generateMonsterSpritesheet,
} from '../sprites/MonsterSprites';

export function registerMonsterAnims(scene: Phaser.Scene, type: MonsterType): void {
  const key = `monster_${type}`;
  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, generateMonsterSpritesheet(type));
  }

  const { w: FW, h: FH } = MONSTER_FRAME_SIZE[type];
  const COLS = Math.floor(scene.textures.get(key).source[0].width / FW);

  const getFrameRange = (row: number, count: number): number[] =>
    Array.from({ length: count }, (_, i) => row * COLS + i);

  const animDefs = [
    { name: `${key}_idle`,   frames: getFrameRange(MONSTER_ANIM_LAYOUT.idle.row,   MONSTER_ANIM_LAYOUT.idle.frames),   fps: 4,  repeat: -1 },
    { name: `${key}_walk`,   frames: getFrameRange(MONSTER_ANIM_LAYOUT.walk.row,   MONSTER_ANIM_LAYOUT.walk.frames),   fps: 8,  repeat: -1 },
    { name: `${key}_attack`, frames: getFrameRange(MONSTER_ANIM_LAYOUT.attack.row, MONSTER_ANIM_LAYOUT.attack.frames), fps: 10, repeat: 0  },
    { name: `${key}_hurt`,   frames: getFrameRange(MONSTER_ANIM_LAYOUT.hurt.row,   MONSTER_ANIM_LAYOUT.hurt.frames),   fps: 8,  repeat: 0  },
    { name: `${key}_death`,  frames: getFrameRange(MONSTER_ANIM_LAYOUT.death.row,  MONSTER_ANIM_LAYOUT.death.frames),  fps: 6,  repeat: 0  },
  ];

  animDefs.forEach(({ name, frames, fps, repeat }) => {
    if (!scene.anims.exists(name)) {
      scene.anims.create({
        key:        name,
        frames:     scene.anims.generateFrameNumbers(key, { frames }),
        frameRate:  fps,
        repeat,
      });
    }
  });
}

export function registerAllMonsterAnims(scene: Phaser.Scene): void {
  const types: MonsterType[] = ['slime', 'goblin', 'wolf', 'golem'];
  types.forEach(type => registerMonsterAnims(scene, type));
}
