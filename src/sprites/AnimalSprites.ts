export type AnimalType = 'rabbit' | 'deer' | 'chicken';
export type AnimalAnim = 'idle' | 'walk' | 'flee';

function drawRabbitFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: AnimalAnim,
  frame: number
): void {
  ctx.clearRect(x, y, 32, 24);
  const hop = (anim === 'walk' || anim === 'flee')
    ? Math.abs(Math.sin(frame * Math.PI / 3)) * (anim === 'flee' ? 8 : 4)
    : 0;

  ctx.fillStyle = '#e8ddd0';
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 18 - hop, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ede3d8';
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 13 - hop, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ede3d8';
  ctx.fillRect(x + 20, y + 3 - hop, 3, 10);
  ctx.fillRect(x + 24, y + 3 - hop, 3, 10);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(x + 21, y + 4 - hop, 1, 8);
  ctx.fillRect(x + 25, y + 4 - hop, 1, 8);

  ctx.fillStyle = '#333';
  ctx.fillRect(x + 23, y + 12 - hop, 2, 2);

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + 9, y + 17 - hop, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDeerFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: AnimalAnim,
  frame: number
): void {
  ctx.clearRect(x, y, 40, 36);
  const walk  = anim !== 'idle';
  const legOsc = walk ? Math.sin(frame * Math.PI / 3) * 5 : 0;

  // 다리
  ctx.fillStyle = '#b07040';
  ctx.fillRect(x + 12, y + 26, 3, 10 + legOsc);
  ctx.fillRect(x + 18, y + 26, 3, 10 - legOsc);
  ctx.fillRect(x + 26, y + 26, 3, 10 - legOsc);
  ctx.fillRect(x + 32, y + 26, 3, 10 + legOsc);

  // 몸통
  ctx.fillStyle = '#c08848';
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 22, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 목
  ctx.fillStyle = '#c08848';
  ctx.fillRect(x + 30, y + 12, 6, 12);

  // 머리
  ctx.fillStyle = '#cc9050';
  ctx.beginPath();
  ctx.ellipse(x + 36, y + 10, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 뿔 (수사슴)
  ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 34, y + 6);
  ctx.lineTo(x + 31, y + 2);
  ctx.lineTo(x + 28, y + 4);
  ctx.moveTo(x + 31, y + 2);
  ctx.lineTo(x + 33, y + 0);
  ctx.stroke();

  // 눈
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 37, y + 8, 2, 2);

  // 흰 배
  ctx.fillStyle = '#e8d8b0';
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 24, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawChickenFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: AnimalAnim,
  frame: number
): void {
  ctx.clearRect(x, y, 24, 24);
  const bob = anim !== 'idle' ? Math.sin(frame * Math.PI / 2) * 2 : 0;

  // 다리
  ctx.fillStyle = '#e0a020';
  ctx.fillRect(x + 9,  y + 18, 2, 6 + bob);
  ctx.fillRect(x + 13, y + 18, 2, 6 - bob);

  // 몸통
  ctx.fillStyle = '#f0f0e0';
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 14, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 날개 힌트
  ctx.fillStyle = '#d8d8c8';
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 14, 4, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 머리
  ctx.fillStyle = '#f0f0e0';
  ctx.beginPath();
  ctx.ellipse(x + 18, y + 8, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 볏
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.ellipse(x + 19, y + 4, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 부리
  ctx.fillStyle = '#e0a020';
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 8);
  ctx.lineTo(x + 25, y + 9);
  ctx.lineTo(x + 22, y + 10);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 19, y + 7, 2, 2);
}

const DRAW_FNS = {
  rabbit:  drawRabbitFrame,
  deer:    drawDeerFrame,
  chicken: drawChickenFrame,
} as const;

const ANIMAL_FRAME_SIZE: Record<AnimalType, { w: number; h: number }> = {
  rabbit:  { w: 32, h: 24 },
  deer:    { w: 40, h: 36 },
  chicken: { w: 24, h: 24 },
};

export function generateAnimalSpritesheet(type: AnimalType): HTMLCanvasElement {
  const { w: FW, h: FH } = ANIMAL_FRAME_SIZE[type];
  const anims: AnimalAnim[] = ['idle', 'walk', 'flee'];
  const FRAMES_PER_ANIM = 6;

  const canvas = document.createElement('canvas');
  canvas.width  = FW * FRAMES_PER_ANIM;
  canvas.height = FH * anims.length;
  const ctx = canvas.getContext('2d')!;

  anims.forEach((anim, row) => {
    for (let f = 0; f < FRAMES_PER_ANIM; f++) {
      ctx.save();
      DRAW_FNS[type](ctx, f * FW, row * FH, anim, f);
      ctx.restore();
    }
  });

  return canvas;
}

export function registerAnimalTextures(scene: Phaser.Scene): void {
  const types: AnimalType[] = ['rabbit', 'deer', 'chicken'];
  for (const type of types) {
    const key = `animal_${type}`;
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, generateAnimalSpritesheet(type));
  }
}
