import Phaser from 'phaser';

const TILE = 32;

const PAL = {
  wood:  { dark: '#a0622a', mid: '#c8884a', light: '#e0aa6a' },
  stone: { dark: '#5a5a5a', mid: '#909090', light: '#c0c0c0' },
};

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeCanvas(w = TILE, h = TILE): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawDirt(): HTMLCanvasElement {
  const c = makeCanvas();
  const ctx = c.getContext('2d')!;
  const rand = seededRand(42);

  ctx.fillStyle = '#a0724a';
  ctx.fillRect(0, 0, TILE, TILE);

  ctx.fillStyle = '#b8895e';
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 2, 1);
  }

  ctx.fillStyle = '#8a5e38';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 2, 2);
  }

  ctx.fillStyle = '#9e8c7a';
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rand() * (TILE - 3)) + 1;
    const y = Math.floor(rand() * (TILE - 3)) + 1;
    ctx.fillRect(x, y, 3, 2);
    ctx.fillStyle = '#b0a090';
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = '#9e8c7a';
  }
  return c;
}

function drawWater(): HTMLCanvasElement {
  const c = makeCanvas();
  const ctx = c.getContext('2d')!;
  const rand = seededRand(99);

  ctx.fillStyle = '#2e6fa3';
  ctx.fillRect(0, 0, TILE, TILE);

  ctx.fillStyle = '#1d5480';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(Math.floor(rand() * (TILE - 6)), Math.floor(rand() * (TILE - 4)), 6, 3);
  }

  ctx.fillStyle = '#6ab8e8';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.floor(rand() * (TILE - 4)), Math.floor(rand() * (TILE - 2)), 4, 1);
  }

  ctx.fillStyle = '#c8e8f8';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(Math.floor(rand() * (TILE - 2)), Math.floor(rand() * (TILE - 1)), 2, 1);
  }
  return c;
}

function drawRock(): HTMLCanvasElement {
  const c = makeCanvas();
  const ctx = c.getContext('2d')!;
  const rand = seededRand(7);

  ctx.fillStyle = '#6b6b6b';
  ctx.fillRect(0, 0, TILE, TILE);

  ctx.fillStyle = '#4a4a4a';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), Math.floor(rand() * 5) + 1, 1);
  }

  ctx.fillStyle = '#909090';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 2, 1);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillRect(0, 0, 1, TILE);
  ctx.fillRect(TILE - 1, 0, 1, TILE);
  ctx.fillRect(0, TILE - 1, TILE, 1);
  return c;
}

function drawTree(): HTMLCanvasElement {
  const c = makeCanvas(32, 48);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 48);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(16, 45, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6b3f1a';
  ctx.fillRect(13, 30, 6, 16);
  ctx.fillStyle = '#8a5230';
  ctx.fillRect(13, 30, 2, 16);

  ctx.fillStyle = '#2d7a3a';
  ctx.beginPath();
  ctx.ellipse(16, 20, 13, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3d9e4a';
  ctx.beginPath();
  ctx.ellipse(15, 18, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#52c45e';
  ctx.beginPath();
  ctx.ellipse(13, 13, 6, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3d9e4a';
  ctx.beginPath();
  ctx.moveTo(16, 2); ctx.lineTo(10, 12); ctx.lineTo(22, 12);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#52c45e';
  ctx.beginPath();
  ctx.moveTo(16, 4); ctx.lineTo(12, 12); ctx.lineTo(20, 12);
  ctx.closePath(); ctx.fill();

  return c;
}

function drawCharacter(dir: 'down' | 'up' | 'left' | 'right'): HTMLCanvasElement {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(16, 30, 7, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  const isBack = dir === 'up';
  const isSide = dir === 'left' || dir === 'right';
  const flip = dir === 'right';

  if (flip) { ctx.save(); ctx.translate(32, 0); ctx.scale(-1, 1); }

  ctx.fillStyle = '#3a5fa0';
  ctx.fillRect(10, 22, 5, 8);
  ctx.fillRect(17, 22, 5, 8);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(9, 28, 6, 3);
  ctx.fillRect(17, 28, 6, 3);

  ctx.fillStyle = '#c84040';
  ctx.fillRect(9, 13, 14, 11);
  ctx.fillStyle = '#e05050';
  ctx.fillRect(9, 13, 4, 11);

  ctx.fillStyle = '#c84040';
  ctx.fillRect(5, 13, 4, 9);
  ctx.fillRect(23, 13, 4, 9);
  ctx.fillStyle = '#f5c8a0';
  ctx.fillRect(5, 21, 4, 3);
  ctx.fillRect(23, 21, 4, 3);

  ctx.fillStyle = '#f5c8a0';
  ctx.fillRect(13, 10, 6, 4);
  ctx.fillRect(9, 3, 14, 12);
  ctx.fillStyle = '#e8b888';
  ctx.fillRect(9, 3, 1, 1);
  ctx.fillRect(22, 3, 1, 1);
  ctx.fillRect(9, 14, 1, 1);
  ctx.fillRect(22, 14, 1, 1);

  if (!isBack) {
    ctx.fillStyle = '#1a1a1a';
    if (isSide) {
      ctx.fillRect(dir === 'left' ? 11 : 19, 7, 2, 2);
    } else {
      ctx.fillRect(11, 7, 3, 2);
      ctx.fillRect(18, 7, 3, 2);
    }
    ctx.fillStyle = '#ffffff';
    if (!isSide) {
      ctx.fillRect(11, 7, 1, 1);
      ctx.fillRect(18, 7, 1, 1);
    }
    ctx.fillStyle = '#c07060';
    if (!isSide) ctx.fillRect(13, 11, 6, 1);
  }

  ctx.fillStyle = '#3a2010';
  ctx.fillRect(9, 3, 14, 3);
  ctx.fillRect(9, 3, 2, 5);
  if (!isBack) ctx.fillRect(21, 3, 2, 5);

  if (flip) ctx.restore();
  return c;
}

function drawEnemy(): HTMLCanvasElement {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(16, 30, 7, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 적군: 붉은 계열 색상 (플레이어와 유사하지만 더 진한 빨강)
  ctx.fillStyle = '#2a3a4a';  // 어두운 회색-파랑 (바지)
  ctx.fillRect(10, 22, 5, 8);
  ctx.fillRect(17, 22, 5, 8);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(9, 28, 6, 3);
  ctx.fillRect(17, 28, 6, 3);

  ctx.fillStyle = '#8b0000';  // 진한 빨강 (상의)
  ctx.fillRect(9, 13, 14, 11);
  ctx.fillStyle = '#cc2222';
  ctx.fillRect(9, 13, 4, 11);

  ctx.fillStyle = '#8b0000';
  ctx.fillRect(5, 13, 4, 9);
  ctx.fillRect(23, 13, 4, 9);
  ctx.fillStyle = '#f5c8a0';  // 피부색 (동일)
  ctx.fillRect(5, 21, 4, 3);
  ctx.fillRect(23, 21, 4, 3);

  ctx.fillStyle = '#f5c8a0';
  ctx.fillRect(13, 10, 6, 4);
  ctx.fillRect(9, 3, 14, 12);
  ctx.fillStyle = '#e8b888';
  ctx.fillRect(9, 3, 1, 1);
  ctx.fillRect(22, 3, 1, 1);
  ctx.fillRect(9, 14, 1, 1);
  ctx.fillRect(22, 14, 1, 1);

  // 얼굴
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(11, 7, 3, 2);
  ctx.fillRect(18, 7, 3, 2);
  ctx.fillStyle = '#ff6666';  // 붉은 눈빛
  ctx.fillRect(11, 7, 1, 1);
  ctx.fillRect(18, 7, 1, 1);
  ctx.fillStyle = '#aa3333';
  ctx.fillRect(13, 11, 6, 1);

  ctx.fillStyle = '#3a2010';
  ctx.fillRect(9, 3, 14, 3);
  ctx.fillRect(9, 3, 2, 5);
  ctx.fillRect(21, 3, 2, 5);

  return c;
}

// ── Item sprites ──────────────────────────────────────────────────────────────

function drawStoneItem(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#7a7a7a';
  ctx.beginPath(); ctx.ellipse(16, 17, 11, 9, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#909090';
  ctx.beginPath(); ctx.ellipse(14, 15, 9, 7, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b0b0b0';
  ctx.fillRect(11, 11, 5, 4);
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(11, 11, 2, 2);
  return c;
}

function drawProcessedStone(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#909090';
  ctx.fillRect(6, 8, 20, 16);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(6, 8, 20, 4);
  ctx.fillRect(6, 8, 3, 16);
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(23, 8, 3, 16);
  ctx.fillRect(6, 21, 20, 3);
  ctx.fillStyle = '#707070';
  ctx.fillRect(6, 14, 20, 1);
  ctx.fillRect(16, 8, 1, 16);
  return c;
}

function drawWoodItem(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ([[4, 8], [8, 12], [12, 8]] as [number, number][]).forEach(([x, y], i) => {
    ctx.fillStyle = i === 1 ? '#c8884a' : '#b87840';
    ctx.fillRect(x, y, 20, 5);
    ctx.fillStyle = '#e0aa6a';
    ctx.fillRect(x, y, 20, 1);
    ctx.fillStyle = '#a0622a';
    ctx.fillRect(x, y + 4, 20, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let j = 0; j < 3; j++) ctx.fillRect(x + 5 + j * 5, y + 1, 1, 3);
  });
  return c;
}

function drawFish(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#e07030';
  ctx.beginPath(); ctx.ellipse(15, 16, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c080';
  ctx.beginPath(); ctx.ellipse(14, 17, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e07030';
  ctx.beginPath();
  ctx.moveTo(25, 16); ctx.lineTo(30, 10); ctx.lineTo(30, 22); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c05020';
  ctx.beginPath();
  ctx.moveTo(13, 10); ctx.lineTo(18, 10); ctx.lineTo(16, 14); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(8, 14, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 13, 1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ([[12, 14], [16, 13], [12, 17], [16, 17]] as [number, number][]).forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  });
  return c;
}

function drawCookedFish(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath(); ctx.ellipse(16, 20, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(16, 19, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b4513';
  ctx.beginPath(); ctx.ellipse(15, 18, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a0522d';
  ctx.beginPath(); ctx.ellipse(14, 17, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b4513';
  ctx.beginPath();
  ctx.moveTo(23, 18); ctx.lineTo(27, 14); ctx.lineTo(27, 22); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a2d0c';
  ctx.fillRect(10, 17, 12, 1);
  ctx.fillRect(12, 15, 8, 1);
  ctx.fillStyle = 'rgba(200,200,200,0.5)';
  ctx.beginPath(); ctx.ellipse(13, 12, 2, 4, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(19, 10, 2, 5, -0.2, 0, Math.PI * 2); ctx.fill();
  return c;
}

function drawRawMeat(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#c04040';
  ctx.beginPath(); ctx.ellipse(16, 18, 10, 8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e05050';
  ctx.beginPath(); ctx.ellipse(14, 16, 8, 6, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0d080';
  ctx.beginPath(); ctx.ellipse(18, 14, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0f0e0';
  ctx.fillRect(20, 10, 3, 16); ctx.fillRect(18, 10, 7, 3); ctx.fillRect(18, 24, 7, 3);
  return c;
}

function drawHide(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#c8864a';
  ctx.beginPath();
  ctx.moveTo(8, 4); ctx.lineTo(24, 4); ctx.lineTo(28, 12);
  ctx.lineTo(26, 24); ctx.lineTo(16, 28); ctx.lineTo(6, 24);
  ctx.lineTo(4, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0aa78';
  ctx.beginPath();
  ctx.moveTo(10, 7); ctx.lineTo(22, 7); ctx.lineTo(25, 14);
  ctx.lineTo(23, 22); ctx.lineTo(16, 25); ctx.lineTo(9, 22);
  ctx.lineTo(7, 14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
  ([[10, 10, 22, 10], [10, 15, 22, 15], [10, 20, 22, 20]] as [number, number, number, number][]).forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  return c;
}

function drawTigerFang(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#f5f0e0';
  ctx.beginPath();
  ctx.moveTo(14, 4); ctx.quadraticCurveTo(8, 10, 12, 26);
  ctx.lineTo(16, 28); ctx.quadraticCurveTo(22, 14, 18, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8d0b0';
  ctx.beginPath();
  ctx.moveTo(18, 4); ctx.quadraticCurveTo(22, 14, 16, 28);
  ctx.lineTo(17, 28); ctx.quadraticCurveTo(23, 14, 19, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d4a060';
  ctx.fillRect(12, 4, 8, 5);
  ctx.fillStyle = '#c8884a';
  ctx.fillRect(12, 4, 8, 2);
  return c;
}

function drawCookedMeat(): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath(); ctx.ellipse(16, 22, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(16, 21, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b2a0a';
  ctx.beginPath(); ctx.ellipse(16, 19, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b3a1a';
  ctx.beginPath(); ctx.ellipse(14, 18, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a1005'; ctx.lineWidth = 1.5;
  ([[10, 17, 22, 17], [11, 20, 21, 20]] as [number, number, number, number][]).forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  ctx.fillStyle = '#f0f0e0';
  ctx.fillRect(21, 13, 2, 12); ctx.fillRect(19, 13, 6, 2); ctx.fillRect(19, 23, 6, 2);
  ctx.fillStyle = 'rgba(200,200,200,0.4)';
  ctx.beginPath(); ctx.ellipse(12, 12, 2, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18, 10, 2, 5, -0.2, 0, Math.PI * 2); ctx.fill();
  return c;
}

// ── Structure sprites ─────────────────────────────────────────────────────────

type Palette = { dark: string; mid: string; light: string };

function structBase(ctx: CanvasRenderingContext2D, pal: Palette): void {
  ctx.fillStyle = pal.mid;
  ctx.fillRect(1, 1, 30, 30);
  ctx.fillStyle = pal.light;
  ctx.fillRect(1, 1, 30, 3);
  ctx.fillRect(1, 1, 3, 30);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(28, 1, 3, 30);
  ctx.fillRect(1, 28, 30, 3);
}

function drawWall(pal: Palette, brick = false): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  structBase(ctx, pal);
  if (brick) {
    ctx.fillStyle = pal.dark;
    [8, 16, 24].forEach(y => ctx.fillRect(1, y, 30, 1));
    [0, 2].forEach(row => {
      const offset = row === 0 ? 0 : 8;
      [offset + 8, offset + 16, offset + 24].forEach(x => ctx.fillRect(x % 30 + 1, row * 8 + 1, 1, 8));
    });
  }
  return c;
}

function drawDoor(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  structBase(ctx, pal);
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(10, 0, 12, 26);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(11, 1, 10, 24);
  ctx.fillStyle = pal.light;
  ctx.fillRect(11, 1, 3, 24);
  ctx.fillStyle = '#d4a017';
  ctx.beginPath(); ctx.arc(19, 14, 2, 0, Math.PI * 2); ctx.fill();
  return c;
}

function drawRoof(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = pal.mid;
  for (let i = -32; i < 64; i += 8) {
    ctx.fillRect(i, 0, 4, 32);
  }
  ctx.fillStyle = pal.light;
  for (let i = -32; i < 64; i += 8) {
    ctx.fillRect(i, 0, 1, 32);
  }
  ctx.fillStyle = pal.dark;
  ctx.fillRect(0, 0, 32, 2);
  ctx.fillRect(0, 0, 2, 32);
  ctx.fillRect(30, 0, 2, 32);
  ctx.fillRect(0, 30, 32, 2);
  return c;
}

function drawBed(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(1, 1, 30, 30);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(3, 3, 26, 26);
  ctx.fillStyle = '#c0d8f0';
  ctx.fillRect(3, 10, 26, 16);
  ctx.fillStyle = '#a8c0e0';
  ctx.fillRect(3, 10, 26, 2);
  [9, 15, 21].forEach(x => { ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, 10, 1, 16); });
  ctx.fillStyle = '#f0f0e0';
  ctx.fillRect(6, 4, 20, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 5, 8, 4);
  ctx.fillRect(17, 5, 8, 4);
  return c;
}

function drawTableFurniture(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(2, 6, 28, 20);
  ctx.fillStyle = pal.light;
  ctx.fillRect(2, 6, 28, 3);
  ctx.fillRect(2, 6, 3, 20);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(27, 6, 3, 20);
  ctx.fillRect(2, 23, 28, 3);
  ctx.fillStyle = pal.dark;
  ([[2, 26], [24, 26], [2, 4], [24, 4]] as [number, number][]).forEach(([x, y]) => ctx.fillRect(x, y, 4, 4));
  return c;
}

function drawChair(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(4, 2, 24, 8);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(5, 3, 22, 6);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(4, 12, 24, 14);
  ctx.fillStyle = pal.light;
  ctx.fillRect(4, 12, 24, 3);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(4, 23, 24, 3);
  ctx.fillStyle = pal.dark;
  ([[4, 26], [22, 26]] as [number, number][]).forEach(([x, y]) => ctx.fillRect(x, y, 4, 5));
  return c;
}

function drawWorkbench(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(1, 8, 30, 18);
  ctx.fillStyle = pal.light;
  ctx.fillRect(1, 8, 30, 4);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(1, 23, 30, 3);
  ctx.fillStyle = pal.dark;
  ([[1, 26], [25, 26]] as [number, number][]).forEach(([x, y]) => ctx.fillRect(x, y, 4, 5));
  ctx.fillStyle = '#555555';
  ctx.fillRect(5, 10, 3, 10);
  ctx.fillStyle = '#888888';
  ctx.fillRect(3, 10, 7, 4);
  ctx.fillStyle = '#666666';
  ctx.fillRect(14, 10, 2, 10);
  ctx.fillRect(12, 10, 6, 3);
  ctx.fillRect(12, 17, 6, 3);
  ctx.fillStyle = '#aaaaaa';
  ([[22, 11], [25, 14], [22, 17]] as [number, number][]).forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  });
  return c;
}

function drawKitchen(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(1, 10, 30, 16);
  ctx.fillStyle = pal.light;
  ctx.fillRect(1, 10, 30, 3);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(1, 23, 30, 3);
  ctx.fillStyle = pal.dark;
  ([[1, 26], [25, 26]] as [number, number][]).forEach(([x, y]) => ctx.fillRect(x, y, 4, 5));
  ctx.fillStyle = '#333333';
  ctx.beginPath(); ctx.ellipse(16, 16, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#555555';
  ctx.beginPath(); ctx.ellipse(16, 15, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#666666';
  ctx.beginPath(); ctx.ellipse(16, 12, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#888888';
  ctx.beginPath(); ctx.ellipse(16, 11, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#444444';
  ctx.fillRect(5, 15, 4, 3);
  ctx.fillRect(23, 15, 4, 3);
  ctx.fillStyle = 'rgba(255,120,0,0.5)';
  ctx.beginPath(); ctx.ellipse(16, 22, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,60,0,0.4)';
  ctx.beginPath(); ctx.ellipse(16, 22, 4, 1, 0, 0, Math.PI * 2); ctx.fill();
  return c;
}

function drawShelf(pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  // Main frame
  ctx.fillStyle = pal.dark;
  ctx.fillRect(3, 8, 26, 20);
  ctx.fillStyle = pal.mid;
  ctx.fillRect(5, 10, 22, 18);

  // Three shelves
  const shelfYs = [13, 18, 23];
  shelfYs.forEach(y => {
    ctx.fillStyle = pal.light;
    ctx.fillRect(5, y, 22, 2);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(5, y + 2, 22, 1);
  });

  // Items on shelves (simple rectangles)
  ctx.fillStyle = '#cc6644';
  ctx.fillRect(7, 11, 3, 2);
  ctx.fillRect(12, 11, 3, 2);
  ctx.fillRect(17, 11, 3, 2);
  ctx.fillRect(22, 11, 3, 2);

  ctx.fillStyle = '#6688cc';
  ctx.fillRect(8, 16, 2, 2);
  ctx.fillRect(13, 16, 2, 2);
  ctx.fillRect(18, 16, 2, 2);
  ctx.fillRect(23, 16, 2, 2);

  ctx.fillStyle = '#88aa44';
  ctx.fillRect(6, 21, 3, 1.5);
  ctx.fillRect(11, 21, 3, 1.5);
  ctx.fillRect(16, 21, 3, 1.5);
  ctx.fillRect(21, 21, 3, 1.5);

  return c;
}

// ── Weapon sprites ───────────────────────────────────────────────────────────

function drawBow(): HTMLCanvasElement {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  // Arc (bow body)
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(22, 16, 13, Math.PI * 0.6, Math.PI * 1.4);
  ctx.stroke();

  // Highlights
  ctx.strokeStyle = '#c8884a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(22, 16, 13, Math.PI * 0.62, Math.PI * 1.0);
  ctx.stroke();

  // String
  ctx.strokeStyle = '#e0d8c0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // tips of arc roughly at (10, 7) and (10, 25)
  ctx.moveTo(10, 5);
  ctx.lineTo(6, 16);
  ctx.lineTo(10, 27);
  ctx.stroke();

  return c;
}

function drawSword(mat: 'wood' | 'stone'): HTMLCanvasElement {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  const bladeColor  = mat === 'stone' ? '#a0a8b0' : '#c8884a';
  const bladeHigh   = mat === 'stone' ? '#d0dae0' : '#e0aa6a';
  const bladeShadow = mat === 'stone' ? '#606870' : '#8a5230';
  const handleColor = '#6b3f1a';

  // Blade (diagonal, top-right to center)
  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(-Math.PI / 4);

  ctx.fillStyle = bladeColor;
  ctx.fillRect(-3, -13, 6, 18);
  ctx.fillStyle = bladeHigh;
  ctx.fillRect(-3, -13, 2, 16);
  ctx.fillStyle = bladeShadow;
  ctx.fillRect(1, -13, 2, 16);

  // Tip
  ctx.fillStyle = bladeColor;
  ctx.beginPath();
  ctx.moveTo(-3, -13);
  ctx.lineTo(3, -13);
  ctx.lineTo(0, -18);
  ctx.closePath();
  ctx.fill();

  // Guard
  ctx.fillStyle = handleColor;
  ctx.fillRect(-7, 5, 14, 3);

  // Handle
  ctx.fillStyle = handleColor;
  ctx.fillRect(-2, 8, 4, 8);
  ctx.fillStyle = '#3a1a08';
  ctx.fillRect(-2, 8, 1, 8);

  ctx.restore();
  return c;
}

function drawArrow(): HTMLCanvasElement {
  const c = makeCanvas(16, 6);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 16, 6);

  // Shaft
  ctx.fillStyle = '#c8a860';
  ctx.fillRect(0, 2, 12, 2);

  // Tip
  ctx.fillStyle = '#8888aa';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(16, 3);
  ctx.lineTo(12, 6);
  ctx.closePath();
  ctx.fill();

  // Fletching
  ctx.fillStyle = '#cc4444';
  ctx.fillRect(0, 1, 3, 1);
  ctx.fillRect(0, 4, 3, 1);

  return c;
}

// ── Animal sprites ────────────────────────────────────────────────────────────

function drawDeer(state: 'idle' | 'walk'): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(16, 30, 8, 2, 0, 0, Math.PI * 2); ctx.fill();

  const legOffset = state === 'walk' ? 2 : 0;

  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(8,  22, 3, 8 + legOffset);
  ctx.fillRect(13, 22, 3, 8 - legOffset);
  ctx.fillRect(18, 22, 3, 8 + legOffset);
  ctx.fillRect(23, 22, 3, 8 - legOffset);

  ctx.fillStyle = '#c8864a';
  ctx.beginPath(); ctx.ellipse(17, 20, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0aa78';
  ctx.beginPath(); ctx.ellipse(17, 22, 7, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#c8864a';
  ctx.fillRect(8, 12, 5, 10);

  ctx.fillStyle = '#c8864a';
  ctx.beginPath(); ctx.ellipse(7, 10, 6, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b5e3c';
  ctx.beginPath(); ctx.ellipse(3, 11, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(6, 8, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 7, 1, 1);

  ctx.fillStyle = '#c8864a';
  ctx.beginPath();
  ctx.moveTo(8, 6); ctx.lineTo(5, 1); ctx.lineTo(11, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0a0a0';
  ctx.beginPath();
  ctx.moveTo(8, 6); ctx.lineTo(6, 2); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = '#6b3f1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(9, 5); ctx.lineTo(10, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(13, 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 3); ctx.lineTo(8, 1); ctx.stroke();

  ctx.fillStyle = '#f0f0e0';
  ctx.beginPath(); ctx.ellipse(27, 18, 3, 4, 0.3, 0, Math.PI * 2); ctx.fill();

  return c;
}

function drawTiger(state: 'idle' | 'walk' | 'attack'): HTMLCanvasElement {
  const c = makeCanvas(); const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 32, 32);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(16, 30, 9, 2, 0, 0, Math.PI * 2); ctx.fill();

  const legOffset = state === 'walk' ? 2 : 0;
  const attackLean = state === 'attack' ? -3 : 0;

  ctx.fillStyle = '#c8622a';
  ctx.fillRect(8,  22, 4, 8 + legOffset);
  ctx.fillRect(14, 22, 4, 8 - legOffset);
  ctx.fillRect(19, 22, 4, 8 + legOffset);
  ctx.fillRect(24, 22, 4, 8 - legOffset);

  ctx.fillStyle = '#e07840';
  ([[8, 28], [14, 28], [19, 28], [24, 28]] as [number, number][]).forEach(([x, y]) => ctx.fillRect(x - 1, y, 6, 3));

  ctx.fillStyle = '#e07030';
  ctx.beginPath(); ctx.ellipse(17 + attackLean, 19, 11, 8, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ([-3, 2, 7]).forEach(dx => {
    ctx.beginPath();
    ctx.moveTo(17 + dx + attackLean, 12);
    ctx.lineTo(15 + dx + attackLean, 26);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.stroke();
  });

  ctx.fillStyle = '#f0c080';
  ctx.beginPath(); ctx.ellipse(17 + attackLean, 21, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#e07030';
  ctx.fillRect(6 + attackLean, 11, 7, 10);

  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(8 + attackLean, 11); ctx.lineTo(8 + attackLean, 20); ctx.stroke();

  ctx.fillStyle = '#e07030';
  ctx.beginPath(); ctx.ellipse(5 + attackLean, 9, 7, 6, -0.2, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ([[3, 4, 3, 8], [6, 3, 6, 8]] as [number, number, number, number][]).forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1 + attackLean, y1);
    ctx.lineTo(x2 + attackLean, y2);
    ctx.stroke();
  });

  ctx.fillStyle = '#e07030';
  ctx.beginPath();
  ctx.moveTo(2 + attackLean, 5); ctx.lineTo(0 + attackLean, 1); ctx.lineTo(5 + attackLean, 3); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8 + attackLean, 4); ctx.lineTo(8 + attackLean, 0); ctx.lineTo(12 + attackLean, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0a080';
  ctx.beginPath();
  ctx.moveTo(3 + attackLean, 5); ctx.lineTo(1 + attackLean, 2); ctx.lineTo(5 + attackLean, 3); ctx.closePath(); ctx.fill();

  ctx.fillStyle = state === 'attack' ? '#ff4400' : '#f0a000';
  ctx.beginPath(); ctx.ellipse(3 + attackLean, 8, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(3 + attackLean, 8, 1, 1.5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#8b2020';
  ctx.beginPath(); ctx.ellipse(0 + attackLean, 10, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
  ([-4, -4, -4] as number[]).forEach((_dx, i) => {
    const dy = [9, 11, 10][i];
    ctx.beginPath();
    ctx.moveTo(0 + attackLean, dy);
    ctx.lineTo(-6 + attackLean, dy + (i - 1));
    ctx.stroke();
  });

  ctx.strokeStyle = '#e07030'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(27, 20); ctx.quadraticCurveTo(32, 14, 30, 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(29, 16); ctx.lineTo(31, 13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, 12); ctx.lineTo(30, 10); ctx.stroke();

  return c;
}

export function registerTextures(scene: Phaser.Scene): void {
  scene.textures.addCanvas('tile_dirt',  drawDirt());
  scene.textures.addCanvas('tile_water', drawWater());
  scene.textures.addCanvas('tile_rock',  drawRock());
  scene.textures.addCanvas('obj_tree',   drawTree());
  scene.textures.addCanvas('char_down',  drawCharacter('down'));
  scene.textures.addCanvas('char_up',    drawCharacter('up'));
  scene.textures.addCanvas('char_left',  drawCharacter('left'));
  scene.textures.addCanvas('char_right', drawCharacter('right'));

  // Items
  scene.textures.addCanvas('item_stone',            drawStoneItem());
  scene.textures.addCanvas('item_processed_stone',  drawProcessedStone());
  scene.textures.addCanvas('item_wood',             drawWoodItem());
  scene.textures.addCanvas('item_fish',             drawFish());
  scene.textures.addCanvas('item_cooked_fish',      drawCookedFish());
  scene.textures.addCanvas('item_raw_meat',         drawRawMeat());
  scene.textures.addCanvas('item_hide',             drawHide());
  scene.textures.addCanvas('item_tiger_fang',       drawTigerFang());
  scene.textures.addCanvas('item_cooked_meat',      drawCookedMeat());

  // Animals
  scene.textures.addCanvas('animal_deer_idle',      drawDeer('idle'));
  scene.textures.addCanvas('animal_deer_walk',      drawDeer('walk'));
  scene.textures.addCanvas('animal_tiger_idle',     drawTiger('idle'));
  scene.textures.addCanvas('animal_tiger_walk',     drawTiger('walk'));
  scene.textures.addCanvas('animal_tiger_attack',   drawTiger('attack'));

  // Enemies
  scene.textures.addCanvas('enemy_idle',            drawEnemy());

  // Structures (wood)
  scene.textures.addCanvas('struct_wall_wood',      drawWall(PAL.wood, true));
  scene.textures.addCanvas('struct_door_wood',      drawDoor(PAL.wood));
  scene.textures.addCanvas('struct_roof_wood',      drawRoof(PAL.wood));
  scene.textures.addCanvas('struct_bed_wood',       drawBed(PAL.wood));
  scene.textures.addCanvas('struct_table_wood',     drawTableFurniture(PAL.wood));
  scene.textures.addCanvas('struct_chair_wood',     drawChair(PAL.wood));
  scene.textures.addCanvas('struct_workbench_wood', drawWorkbench(PAL.wood));
  scene.textures.addCanvas('struct_kitchen_wood',   drawKitchen(PAL.wood));

  // Structures (stone)
  scene.textures.addCanvas('struct_wall_stone',      drawWall(PAL.stone, true));
  scene.textures.addCanvas('struct_door_stone',      drawDoor(PAL.stone));
  scene.textures.addCanvas('struct_roof_stone',      drawRoof(PAL.stone));
  scene.textures.addCanvas('struct_bed_stone',       drawBed(PAL.stone));
  scene.textures.addCanvas('struct_table_stone',     drawTableFurniture(PAL.stone));
  scene.textures.addCanvas('struct_chair_stone',     drawChair(PAL.stone));
  scene.textures.addCanvas('struct_workbench_stone', drawWorkbench(PAL.stone));
  scene.textures.addCanvas('struct_kitchen_stone',   drawKitchen(PAL.stone));
  scene.textures.addCanvas('struct_shelf_wood',      drawShelf(PAL.wood));
  scene.textures.addCanvas('struct_shelf_stone',     drawShelf(PAL.stone));

  // Weapons & projectiles
  scene.textures.addCanvas('item_bow',           drawBow());
  scene.textures.addCanvas('item_sword_wood',    drawSword('wood'));
  scene.textures.addCanvas('item_sword_stone',   drawSword('stone'));
  scene.textures.addCanvas('projectile_arrow',   drawArrow());
}
