import Phaser from 'phaser';

/**
 * 문 3프레임 개폐 tween + 먼지 파티클.
 * DoorSystem에서 문 개폐 시 호출.
 */
export class DoorAnimator {
  constructor(private scene: Phaser.Scene) {}

  /** 문 열리는 애니메이션 (frame 0→1→2) */
  open(doorSprite: Phaser.GameObjects.Sprite): void {
    doorSprite.setFrame(1);
    this.scene.time.delayedCall(100, () => {
      if (doorSprite.active) doorSprite.setFrame(2);
    });
    this.spawnDoorDust(doorSprite.x, doorSprite.y);
  }

  /** 문 닫히는 애니메이션 (frame 2→1→0) */
  close(doorSprite: Phaser.GameObjects.Sprite): void {
    doorSprite.setFrame(1);
    this.scene.time.delayedCall(120, () => {
      if (doorSprite.active) doorSprite.setFrame(0);
    });
  }

  private spawnDoorDust(x: number, y: number): void {
    if (!this.scene.textures.exists('fx_pixel')) return;
    const emitter = this.scene.add.particles(x, y, 'fx_pixel', {
      tint:     [0xc8a870, 0xe0c090],
      speed:    { min: 10, max: 30 },
      angle:    { min: 150, max: 210 },
      scale:    { start: 0.6, end: 0 },
      lifespan: 400,
      quantity: 3,
      emitting: false,
    });
    emitter.explode(3);
    this.scene.time.delayedCall(500, () => emitter.destroy());
  }
}

/** 문 스프라이트 캔버스 (wood/iron, 3프레임) 생성 */
export function drawDoorCanvas(frame: 0 | 1 | 2, material: 'wood' | 'iron'): HTMLCanvasElement {
  const W = 16, H = 32;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const colors = material === 'wood'
    ? { body: '#7a4a20', trim: '#5a3010', knob: '#c8a020' }
    : { body: '#707070', trim: '#404040', knob: '#a0a0a0' };

  if (frame === 0) {
    ctx.fillStyle = colors.body;
    ctx.fillRect(1, 0, W - 2, H);
    ctx.fillStyle = colors.trim;
    ctx.fillRect(3, 4, 10, 10);
    ctx.fillRect(3, 18, 10, 10);
    ctx.fillStyle = colors.knob;
    ctx.fillRect(10, 14, 3, 4);
  } else if (frame === 1) {
    ctx.fillStyle = colors.body;
    ctx.fillRect(1, 0, (W - 2) / 2, H);
    ctx.fillStyle = colors.trim;
    ctx.fillRect(2, 4, 4, 8);
  } else {
    ctx.fillStyle = colors.body;
    ctx.fillRect(1, 0, 3, H);
    ctx.fillStyle = colors.trim;
    ctx.fillRect(2, 0, 1, H);
  }

  return canvas;
}

/** SpriteGenerator 호출용 문 텍스처 등록 */
export function registerDoorTextures(scene: Phaser.Scene): void {
  for (const mat of ['wood', 'iron'] as const) {
    for (const frame of [0, 1, 2] as const) {
      const key = `door_${mat}_${frame}`;
      if (!scene.textures.exists(key)) {
        scene.textures.addCanvas(key, drawDoorCanvas(frame, mat));
      }
    }
  }
}
