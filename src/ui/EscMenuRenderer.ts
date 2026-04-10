import Phaser from 'phaser';

const ESC_MENU_ITEMS = ['▶ 게임 재개', '설 정', '도움말', '타이틀로', '게임 종료'];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getCurrentDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export class EscMenuRenderer {
  private panel: Phaser.GameObjects.RenderTexture;
  private dim: Phaser.GameObjects.Rectangle;
  private selectedIdx = 0;
  private onSelect?: (idx: number) => void;
  private scene: Phaser.Scene;
  private readonly W = 200;
  private readonly H = 280;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cam = scene.cameras.main;

    this.dim = scene.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);

    this.panel = scene.add.renderTexture(
      (cam.width - this.W) / 2,
      (cam.height - this.H) / 2,
      this.W, this.H
    ).setScrollFactor(0).setDepth(111).setVisible(false);
  }

  show(onSelect: (idx: number) => void): void {
    this.onSelect = onSelect;
    this.selectedIdx = 0;
    this.dim.setVisible(true);
    this.panel.setVisible(true).setScale(0.85).setAlpha(0);
    this.redraw();
    this.scene.tweens.add({
      targets: this.panel, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200, ease: 'Back.easeOut'
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.panel, scaleX: 0.85, scaleY: 0.85, alpha: 0,
      duration: 150,
      onComplete: () => {
        this.panel.setVisible(false);
        this.dim.setVisible(false);
      }
    });
  }

  moveSelection(dir: 1 | -1): void {
    this.selectedIdx = (this.selectedIdx + dir + ESC_MENU_ITEMS.length) % ESC_MENU_ITEMS.length;
    this.redraw();
  }

  confirmSelection(): void {
    this.onSelect?.(this.selectedIdx);
  }

  private redraw(): void {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.W;
    offCanvas.height = this.H;
    const ctx = offCanvas.getContext('2d')!;
    const cx = this.W / 2;

    ctx.fillStyle = 'rgba(10, 8, 5, 0.96)';
    roundRect(ctx, 0, 0, this.W, this.H, 6);
    ctx.fill();
    ctx.strokeStyle = '#5a4428';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 0, 0, this.W, this.H, 6);
    ctx.stroke();

    ctx.fillStyle = '#f0c030';
    ctx.fillRect(0, 0, this.W, 3);

    ctx.fillStyle = '#e8d8b0';
    ctx.font = 'bold 12px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('⚙ 메뉴', cx, 24);

    ESC_MENU_ITEMS.forEach((label, i) => {
      const y = 56 + i * 36;
      const isSelected = i === this.selectedIdx;
      if (isSelected) {
        ctx.fillStyle = 'rgba(240,192,48,0.15)';
        roundRect(ctx, 16, y - 14, this.W - 32, 24, 3);
        ctx.fill();
        ctx.fillStyle = '#f0c030';
        ctx.fillRect(16, y - 12, 3, 20);
      }
      ctx.fillStyle = isSelected ? '#f0c030' : '#c8b88a';
      ctx.font = isSelected ? 'bold 11px "Courier New"' : '11px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, y + 4);
    });

    ctx.fillStyle = '#6a5a38';
    ctx.font = '8px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`v0.59.0   ${getCurrentDateStr()}`, cx, this.H - 12);

    const tex = this.scene.textures.addCanvas('_esc_menu_tmp', offCanvas);
    this.panel.clear();
    this.panel.draw(tex, 0, 0);
  }

  isVisible(): boolean {
    return this.panel.visible;
  }

  destroy(): void {
    this.panel.destroy();
    this.dim.destroy();
  }
}
