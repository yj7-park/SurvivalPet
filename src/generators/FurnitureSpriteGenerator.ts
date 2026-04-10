// Plan 58: 가구 스프라이트 절차적 생성 (Canvas 2D API)

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | [number, number, number, number]
): void {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

export function drawBed(ctx: CanvasRenderingContext2D, material: 'wood' | 'stone'): void {
  const frameColor = material === 'wood' ? '#6a3a10' : '#7a7870';
  const mattress   = '#e8d8b0';
  const pillow     = '#f8f0e0';
  const blanket    = material === 'wood' ? '#8060a0' : '#6080a0';

  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, 32, 48);

  ctx.fillStyle = mattress;
  ctx.fillRect(3, 8, 26, 36);

  ctx.fillStyle = blanket;
  ctx.fillRect(3, 24, 26, 20);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(6 + i * 8, 24);
    ctx.lineTo(6 + i * 8, 44);
    ctx.stroke();
  }

  ctx.fillStyle = pillow;
  roundRect(ctx, 5, 10, 22, 11, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, 5, 10, 22, 11, 3);
  ctx.stroke();

  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, 32, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(6, 2, 8, 4);
  ctx.fillRect(18, 2, 8, 4);
}

export function drawChair(ctx: CanvasRenderingContext2D, material: 'wood' | 'stone'): void {
  const c = material === 'wood'
    ? { body: '#7a4a20', seat: '#9a6030', shadow: '#4a2a10' }
    : { body: '#808070', seat: '#a0a090', shadow: '#505048' };

  ctx.fillStyle = c.body;
  ctx.fillRect(2, 0, 12, 12);
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 2, 2, 8);
  ctx.fillRect(9, 2, 2, 8);

  ctx.fillStyle = c.seat;
  ctx.fillRect(1, 12, 14, 4);

  ctx.fillStyle = c.body;
  ctx.fillRect(2, 16, 3, 8);
  ctx.fillRect(11, 16, 3, 8);
}

export function drawTable(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#8a5a28';
  roundRect(ctx, 2, 4, 44, 16, 3);
  ctx.fill();

  ctx.strokeStyle = 'rgba(60,30,8,0.3)';
  ctx.lineWidth = 1;
  [10, 24, 38].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 5);
    ctx.lineTo(x, 19);
    ctx.stroke();
  });

  ctx.fillStyle = '#6a4018';
  ctx.fillRect(4, 20, 4, 12);
  ctx.fillRect(40, 20, 4, 12);
  ctx.fillRect(13, 20, 4, 10);
  ctx.fillRect(31, 20, 4, 10);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(2, 19, 44, 2);
}

export function drawWorkbench(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#6a3a10';
  ctx.fillRect(0, 12, 48, 28);

  ctx.fillStyle = '#8a5228';
  ctx.fillRect(0, 8, 48, 10);

  ctx.strokeStyle = 'rgba(50,25,5,0.3)';
  ctx.lineWidth = 1;
  [8, 16, 24, 32, 40].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x - 2, 18);
    ctx.stroke();
  });

  // 망치 실루엣
  ctx.fillStyle = '#c0a060';
  ctx.fillRect(8, 10, 3, 6);
  ctx.fillRect(5, 7, 9, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(5, 7, 9, 1);

  // 톱 실루엣
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(28, 9, 14, 2);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(28 + i * 2, 11, 2, 2);
  }

  // 서랍
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(4, 16, 16, 8);
  ctx.fillRect(28, 16, 16, 8);
  ctx.fillStyle = '#c8a040';
  ctx.fillRect(11, 19, 4, 2);
  ctx.fillRect(35, 19, 4, 2);
}

export function drawCookingStation(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#6a6460';
  ctx.fillRect(0, 10, 48, 30);

  ctx.fillStyle = '#808480';
  ctx.fillRect(0, 6, 48, 10);

  ctx.fillStyle = '#3a3430';
  ctx.beginPath();
  ctx.ellipse(14, 11, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(34, 11, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c0c0b8';
  ctx.fillRect(4, 18, 16, 6);
  ctx.fillRect(28, 18, 16, 6);
}

export function drawChest(ctx: CanvasRenderingContext2D, open: boolean): void {
  ctx.fillStyle = '#7a4a18';
  ctx.fillRect(2, 14, 28, 14);

  ctx.strokeStyle = '#c8a030';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(2, 14, 28, 14);
  ctx.beginPath();
  ctx.moveTo(16, 14);
  ctx.lineTo(16, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, 21);
  ctx.lineTo(30, 21);
  ctx.stroke();

  ctx.fillStyle = '#e0b840';
  ctx.fillRect(13, 19, 6, 5);
  ctx.strokeStyle = '#c89020';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(16, 19, 3, Math.PI, 0);
  ctx.stroke();

  if (!open) {
    ctx.fillStyle = '#8a5528';
    roundRect(ctx, 2, 4, 28, 12, [4, 4, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#c8a030';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 2, 4, 28, 12, [4, 4, 0, 0]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,30,8,0.25)';
    ctx.lineWidth = 1;
    [8, 16, 24].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 5);
      ctx.lineTo(x, 15);
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = '#8a5528';
    roundRect(ctx, 2, 0, 28, 5, [2, 2, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#c8a030';
    ctx.lineWidth = 1;
    roundRect(ctx, 2, 0, 28, 5, [2, 2, 0, 0]);
    ctx.stroke();
  }
}

export function drawFence(ctx: CanvasRenderingContext2D, mask: number): void {
  // mask: N=1, E=2, S=4, W=8
  ctx.fillStyle = '#7a4a20';

  ctx.fillRect(13, 4, 6, 20);

  if (mask & 2) {
    ctx.fillRect(19, 8, 13, 3);
    ctx.fillRect(19, 14, 13, 3);
  }
  if (mask & 8) {
    ctx.fillRect(0, 8, 13, 3);
    ctx.fillRect(0, 14, 13, 3);
  }
  if (mask & 1) {
    ctx.fillRect(13, 0, 6, 4);
  }
  if (mask & 4) {
    ctx.fillRect(13, 24, 6, 8);
  }
}

/**
 * 모든 가구 텍스처를 Phaser scene에 등록하는 유틸리티
 */
export function registerFurnitureTextures(scene: Phaser.Scene): void {
  const specs: Array<{ key: string; w: number; h: number; draw: (ctx: CanvasRenderingContext2D) => void }> = [
    { key: 'bed_wood',  w: 32, h: 48, draw: ctx => drawBed(ctx, 'wood') },
    { key: 'bed_stone', w: 32, h: 48, draw: ctx => drawBed(ctx, 'stone') },
    { key: 'chair_wood',  w: 16, h: 24, draw: ctx => drawChair(ctx, 'wood') },
    { key: 'chair_stone', w: 16, h: 24, draw: ctx => drawChair(ctx, 'stone') },
    { key: 'table_wood', w: 48, h: 32, draw: drawTable },
    { key: 'workbench',  w: 48, h: 40, draw: drawWorkbench },
    { key: 'cooking_station', w: 48, h: 40, draw: drawCookingStation },
    { key: 'chest_wood',      w: 32, h: 28, draw: ctx => drawChest(ctx, false) },
    { key: 'chest_wood_open', w: 32, h: 28, draw: ctx => drawChest(ctx, true) },
    ...Array.from({ length: 16 }, (_, i) => ({
      key: `fence_${i}`,
      w: 32, h: 24,
      draw: (ctx: CanvasRenderingContext2D) => drawFence(ctx, i)
    }))
  ];

  specs.forEach(({ key, w, h, draw }) => {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    (ctx as any).imageSmoothingEnabled = false;
    draw(ctx);
    scene.textures.addCanvas(key, canvas);
  });
}
