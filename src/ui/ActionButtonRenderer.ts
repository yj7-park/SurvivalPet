import Phaser from 'phaser';

export interface ActionButtonConfig {
  id:     string;
  icon:   string;
  label:  string;
  radius: number;
  color:  number;
  key:    string;
}

export const ACTION_BUTTONS: ActionButtonConfig[] = [
  { id: 'attack',    icon: '⚔',  label: 'ATK', radius: 36, color: 0xe04040, key: 'SPC' },
  { id: 'inventory', icon: '🎒', label: 'INV', radius: 28, color: 0x4080c0, key: 'I'   },
  { id: 'equip',     icon: '🛡',  label: 'EQP', radius: 28, color: 0x60a040, key: 'E'   },
  { id: 'build',     icon: '🔨', label: 'BLD', radius: 28, color: 0xc8a030, key: 'B'   },
  { id: 'help',      icon: '?',   label: 'HLP', radius: 28, color: 0x808080, key: 'H'   },
];

export function drawActionButton(
  ctx: CanvasRenderingContext2D,
  cfg: ActionButtonConfig,
  cx: number, cy: number,
  state: 'idle' | 'pressed' | 'cooldown',
  cooldownRatio?: number
): void {
  const R = cfg.radius;

  ctx.fillStyle = state === 'pressed'
    ? 'rgba(255,255,255,0.25)'
    : 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  const hexColor = '#' + cfg.color.toString(16).padStart(6, '0');
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = state === 'pressed' ? 3 : 2;
  ctx.globalAlpha = state === 'cooldown' ? 0.4 : 1.0;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1.0;

  if (state === 'cooldown' && cooldownRatio !== undefined) {
    const endAngle = -Math.PI / 2 + (1 - cooldownRatio) * Math.PI * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -Math.PI / 2, endAngle, false);
    ctx.closePath(); ctx.fill();
  }

  ctx.globalAlpha = state === 'cooldown' ? 0.5 : 1.0;
  ctx.font = `${R * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.icon, cx, cy - 2);
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '7px "Courier New"';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(cfg.key, cx, cy + R + 9);
}

export function playButtonPressRipple(
  scene: Phaser.Scene,
  cx: number, cy: number,
  color: number,
  buttonContainer?: Phaser.GameObjects.Container
): void {
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(76);
  const obj = { r: 0, a: 0.7 };
  scene.tweens.add({
    targets: obj, r: 50, a: 0,
    duration: 250, ease: 'Quad.easeOut',
    onUpdate: () => {
      gfx.clear();
      gfx.lineStyle(2, color, obj.a);
      gfx.strokeCircle(cx, cy, obj.r);
    },
    onComplete: () => gfx.destroy()
  });

  if (buttonContainer) {
    scene.tweens.add({
      targets: buttonContainer,
      scaleX: [0.85, 1.05, 1.0],
      scaleY: [0.85, 1.05, 1.0],
      duration: 200, ease: 'Back.easeOut'
    });
  }
}

export function showPinchZoomIndicator(scene: Phaser.Scene, zoom: number): void {
  let zoomLabel = scene.data.get('zoomLabel') as Phaser.GameObjects.Text | undefined;
  if (!zoomLabel) {
    zoomLabel = scene.add.text(
      scene.cameras.main.width / 2, 40, '',
      { fontSize: '11px', fontFamily: 'Courier New',
        color: '#f0c030', stroke: '#000', strokeThickness: 2 }
    ).setScrollFactor(0).setDepth(89).setOrigin(0.5).setAlpha(0);
    scene.data.set('zoomLabel', zoomLabel);
  }

  zoomLabel.setText(`🔍 ${zoom.toFixed(1)}×`).setAlpha(1);
  scene.time.delayedCall(1200, () => {
    scene.tweens.add({ targets: zoomLabel, alpha: 0, duration: 400 });
  });
}
