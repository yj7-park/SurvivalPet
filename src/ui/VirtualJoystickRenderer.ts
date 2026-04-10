import Phaser from 'phaser';

function drawSmallArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angleDeg: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleDeg * Math.PI / 180);
  ctx.beginPath();
  ctx.moveTo(0, -5); ctx.lineTo(-4, 2); ctx.lineTo(4, 2);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawJoystickBase(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  active: boolean
): void {
  const R = 56;

  const grad = ctx.createRadialGradient(cx, cy, R - 8, cx, cy, R + 2);
  grad.addColorStop(0,   active ? 'rgba(240,192,48,0.35)' : 'rgba(255,255,255,0.20)');
  grad.addColorStop(0.5, active ? 'rgba(240,192,48,0.15)' : 'rgba(255,255,255,0.08)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = active ? 'rgba(240,192,48,0.08)' : 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const arrowOffset = R - 10;
  drawSmallArrow(ctx, cx,               cy - arrowOffset, 0);
  drawSmallArrow(ctx, cx,               cy + arrowOffset, 180);
  drawSmallArrow(ctx, cx - arrowOffset, cy,               270);
  drawSmallArrow(ctx, cx + arrowOffset, cy,               90);
}

export function drawJoystickHandle(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number,
  active: boolean,
  magnitude: number
): void {
  const R = 24;

  if (active && magnitude > 0.1) {
    const glowR = R + 6 * magnitude;
    const glowGrad = ctx.createRadialGradient(hx, hy, R * 0.5, hx, hy, glowR);
    glowGrad.addColorStop(0, `rgba(240,192,48,${0.4 * magnitude})`);
    glowGrad.addColorStop(1, 'rgba(240,192,48,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(hx, hy, glowR, 0, Math.PI * 2); ctx.fill();
  }

  const bodyGrad = ctx.createRadialGradient(hx - R * 0.3, hy - R * 0.3, 2, hx, hy, R);
  bodyGrad.addColorStop(0,   active ? 'rgba(255,240,180,0.75)' : 'rgba(255,255,255,0.55)');
  bodyGrad.addColorStop(0.6, active ? 'rgba(240,192,48,0.55)' : 'rgba(200,200,200,0.35)');
  bodyGrad.addColorStop(1,   active ? 'rgba(180,120,20,0.40)' : 'rgba(100,100,100,0.20)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.beginPath();
  ctx.arc(hx - 4, hy - 6, R * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = active ? 'rgba(240,192,48,0.8)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
}

export function drawJoystickDirectionArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  dx: number, dy: number,
  magnitude: number
): void {
  if (magnitude < 0.15) return;

  const angle = Math.atan2(dy, dx);
  const R = 56;
  const arcSpan = Math.PI * 0.45;

  ctx.strokeStyle = `rgba(240,192,48,${0.5 * magnitude})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 4, angle - arcSpan / 2, angle + arcSpan / 2);
  ctx.stroke();
}

export function playJoystickAppearEffect(scene: Phaser.Scene, x: number, y: number): void {
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(75);
  const obj = { r: 0, a: 0.6 };
  scene.tweens.add({
    targets: obj, r: 64, a: 0,
    duration: 300, ease: 'Quad.easeOut',
    onUpdate: () => {
      gfx.clear();
      gfx.lineStyle(2, 0xf0c030, obj.a);
      gfx.strokeCircle(x, y, obj.r);
    },
    onComplete: () => gfx.destroy()
  });
}

export function showPortraitWarning(scene: Phaser.Scene): void {
  if (scene.scale.width > scene.scale.height) return;

  const cam = scene.cameras.main;
  const warn = scene.add.text(
    cam.width / 2, cam.height / 2,
    '📱 화면을 가로로 돌려주세요',
    {
      fontSize: '16px', fontFamily: 'Courier New',
      color: '#f0c030', stroke: '#000000', strokeThickness: 3,
      align: 'center'
    }
  ).setScrollFactor(0).setDepth(200).setOrigin(0.5);

  scene.tweens.add({
    targets: warn, angle: { from: -10, to: 10 },
    duration: 600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
  });
}
