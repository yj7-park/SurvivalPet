export type MonsterType = 'slime' | 'goblin' | 'wolf' | 'golem';
export type MonsterAnim = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export const MONSTER_ANIM_LAYOUT = {
  idle:   { row: 0, frames: 4 },
  walk:   { row: 1, frames: 6 },
  attack: { row: 2, frames: 5 },
  hurt:   { row: 3, frames: 2 },
  death:  { row: 4, frames: 6 },
} as const;

export const MONSTER_FRAME_SIZE: Record<MonsterType, { w: number; h: number }> = {
  slime:  { w: 32, h: 32 },
  goblin: { w: 32, h: 32 },
  wolf:   { w: 48, h: 32 },
  golem:  { w: 64, h: 64 },
};

export const MONSTER_TINTS: Record<MonsterType, number> = {
  slime:  0x44cc66,
  goblin: 0x4a8a4a,
  wolf:   0x778899,
  golem:  0x7a7a8e,
};

function drawSlimeFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: MonsterAnim,
  frame: number,
  color = 0x44cc66
): void {
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  const cx  = x + 16;
  const cy  = y + 20;
  ctx.clearRect(x, y, 32, 32);

  if (anim === 'death') {
    const flatness = frame / 5;
    ctx.fillStyle   = hex;
    ctx.globalAlpha = 1 - flatness * 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, y + 28, 12 + flatness * 4, 6 - flatness * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const bounce = anim === 'idle'
    ? Math.sin(frame * Math.PI / 2) * 2
    : Math.sin(frame * Math.PI / 3) * 3;
  const bodyH = 14 - bounce;
  const bodyW = 12 + bounce * 0.5;

  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.ellipse(cx, cy - bodyH / 2, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff44';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - bodyH / 2 - 3, bodyW * 0.4, bodyH * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  const eyeColor = anim === 'attack' ? '#ff2020' : '#ffffff';
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - bodyH / 2, 2, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 3, cy - bodyH / 2, 2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - bodyH / 2 + 0.5, 1, 1.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 3, cy - bodyH / 2 + 0.5, 1, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (anim === 'hurt') {
    ctx.fillStyle = '#ff000033';
    ctx.beginPath();
    ctx.ellipse(cx, cy - bodyH / 2, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoblinFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: MonsterAnim,
  frame: number
): void {
  ctx.clearRect(x, y, 32, 32);

  const legSwing = anim === 'walk' ? Math.sin(frame * Math.PI / 3) * 4 : 0;
  ctx.fillStyle = '#3a6e3a';
  ctx.fillRect(x + 11, y + 22, 4, 8 + legSwing);
  ctx.fillRect(x + 17, y + 22, 4, 8 - legSwing);

  ctx.fillStyle = '#4a8a4a';
  ctx.fillRect(x + 10, y + 14, 12, 10);

  ctx.fillStyle = '#5aa05a';
  ctx.fillRect(x + 11, y + 6, 10, 9);

  ctx.fillStyle = '#5aa05a';
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 8); ctx.lineTo(x + 8,  y + 4); ctx.lineTo(x + 12, y + 9); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 21, y + 8); ctx.lineTo(x + 24, y + 4); ctx.lineTo(x + 20, y + 9); ctx.fill();

  ctx.fillStyle = anim === 'attack' ? '#ff4400' : '#ffee00';
  ctx.fillRect(x + 13, y + 8, 3, 3);
  ctx.fillRect(x + 18, y + 8, 3, 3);

  if (anim === 'attack') {
    const swingAngle = frame < 2 ? -Math.PI / 4 : Math.PI / 3;
    ctx.save();
    ctx.translate(x + 22, y + 16);
    ctx.rotate(swingAngle);
    ctx.fillStyle = '#8B6914'; ctx.fillRect(-2, -10, 3, 12);
    ctx.fillStyle = '#a07820'; ctx.fillRect(-3, -12, 5, 5);
    ctx.restore();
  }

  if (anim === 'death') {
    ctx.globalAlpha = Math.max(0, 1 - frame * 0.18);
  }
}

function drawWolfFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: MonsterAnim,
  frame: number
): void {
  ctx.clearRect(x, y, 48, 32);
  const walkCycle = anim === 'walk' ? frame / 6 : 0;
  const bodyBob   = Math.sin(walkCycle * Math.PI * 2) * 1.5;

  ctx.fillStyle = '#778899';
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 20 + bodyBob, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const legPositions = [x + 14, x + 18, x + 28, x + 32];
  ctx.fillStyle = '#667788';
  legPositions.forEach((lx, i) => {
    const legAngle = Math.sin(walkCycle * Math.PI * 2 + i * Math.PI * 0.5) * 0.4;
    ctx.fillRect(lx, y + 24 + bodyBob, 3, 7 + Math.sin(legAngle) * 3);
  });

  ctx.fillStyle = '#889aaa';
  ctx.beginPath();
  ctx.ellipse(x + 38, y + 17 + bodyBob, 8, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#99abb8';
  ctx.beginPath();
  ctx.ellipse(x + 44, y + 19 + bodyBob, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = anim === 'attack' ? '#ff2200' : '#ffdd00';
  ctx.fillRect(x + 38, y + 15 + bodyBob, 3, 2);

  const tailAngle = Math.sin(walkCycle * Math.PI * 2 + Math.PI) * 0.5;
  ctx.strokeStyle = '#778899';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 18 + bodyBob);
  ctx.quadraticCurveTo(
    x + 2, y + 10 + bodyBob + tailAngle * 8,
    x + 5, y + 8  + bodyBob + tailAngle * 12
  );
  ctx.stroke();
}

function drawGolemFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: MonsterAnim,
  frame: number
): void {
  ctx.clearRect(x, y, 64, 64);
  const shake = (anim === 'attack' && frame >= 2) ? Math.sin(frame * Math.PI) * 3 : 0;

  ctx.fillStyle = '#666677';
  ctx.fillRect(x + 12 + shake, y + 46, 14, 16);
  ctx.fillRect(x + 38 - shake, y + 46, 14, 16);

  ctx.fillStyle = '#7a7a8e';
  ctx.fillRect(x + 8, y + 22, 48, 26);

  ctx.strokeStyle = '#55555f'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 22); ctx.lineTo(x + 25, y + 35); ctx.lineTo(x + 18, y + 48);
  ctx.moveTo(x + 38, y + 25); ctx.lineTo(x + 44, y + 40); ctx.lineTo(x + 36, y + 48);
  ctx.stroke();

  const armRaise = anim === 'attack' ? -frame * 5 : 0;
  ctx.fillStyle = '#7a7a8e';
  ctx.fillRect(x + 0,  y + 24 + armRaise, 10, 20);
  ctx.fillRect(x + 54, y + 24 + armRaise, 10, 20);

  ctx.fillStyle = '#8a8a9e';
  ctx.fillRect(x + 16, y + 4, 32, 20);

  const eyeColor = anim === 'attack' ? '#ff4400' : '#cc4400';
  ctx.fillStyle  = eyeColor;
  ctx.fillRect(x + 21, y + 10, 8, 6);
  ctx.fillRect(x + 35, y + 10, 8, 6);
  ctx.fillStyle = eyeColor + '44';
  ctx.fillRect(x + 19, y + 8,  12, 10);
  ctx.fillRect(x + 33, y + 8,  12, 10);

  if (anim === 'death') {
    ctx.globalAlpha = Math.max(0, 1 - frame * 0.18);
    ctx.translate(0, frame * 2);
  }
}

const DRAW_FNS = {
  slime:  drawSlimeFrame,
  goblin: drawGoblinFrame,
  wolf:   drawWolfFrame,
  golem:  drawGolemFrame,
} as const;

export function generateMonsterSpritesheet(type: MonsterType): HTMLCanvasElement {
  const { w: FW, h: FH } = MONSTER_FRAME_SIZE[type];
  const COLS = 6, ROWS = 5;

  const canvas = document.createElement('canvas');
  canvas.width  = FW * COLS;
  canvas.height = FH * ROWS;
  const ctx = canvas.getContext('2d')!;

  const ANIMS: MonsterAnim[] = ['idle', 'walk', 'attack', 'hurt', 'death'];
  ANIMS.forEach((anim, row) => {
    const frameCount = MONSTER_ANIM_LAYOUT[anim].frames;
    for (let f = 0; f < frameCount; f++) {
      ctx.save();
      (DRAW_FNS[type] as (
        ctx: CanvasRenderingContext2D, x: number, y: number,
        anim: MonsterAnim, frame: number
      ) => void)(ctx, f * FW, row * FH, anim, f);
      ctx.restore();
    }
  });

  return canvas;
}
