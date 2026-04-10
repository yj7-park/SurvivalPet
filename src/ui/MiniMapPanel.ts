export class MiniMapPanel {
  private overlay: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private blinkOn = true;
  private blinkTimer = 0;

  constructor(
    private getMapXY: () => { mapX: number; mapY: number },
    private getVisited: () => Set<string>,
  ) {}

  toggle(): void {
    if (this.overlay) { this.close(); } else { this.open(); }
  }

  open(): void {
    if (this.overlay) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;bottom:16px;right:16px;
      background:rgba(5,10,5,0.9);border:1px solid #446;
      border-radius:6px;padding:10px;z-index:200;
    `;
    overlay.innerHTML = `
      <div style="color:#aaa;font:10px monospace;margin-bottom:6px;text-align:center">지도 (M)</div>
    `;

    const canvas = document.createElement('canvas');
    canvas.width = 10 * 6;  // 60px
    canvas.height = 10 * 6; // 60px
    canvas.style.cssText = 'display:block;image-rendering:pixelated';
    overlay.appendChild(canvas);

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.canvas = canvas;
    this.render();
  }

  update(deltaMs: number): void {
    if (!this.overlay) return;
    this.blinkTimer += deltaMs;
    if (this.blinkTimer >= 400) {
      this.blinkTimer = 0;
      this.blinkOn = !this.blinkOn;
      this.render();
    }
  }

  private render(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { mapX, mapY } = this.getMapXY();
    const visited = this.getVisited();
    const CELL = 6;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let my = 0; my < 10; my++) {
      for (let mx = 0; mx < 10; mx++) {
        const isCurrent = mx === mapX && my === mapY;
        const isVisited = visited.has(`${mx},${my}`);

        if (isCurrent) {
          ctx.fillStyle = this.blinkOn ? '#6aee6a' : '#3a9a3a';
        } else if (isVisited) {
          ctx.fillStyle = '#3a5f3a';
        } else {
          ctx.fillStyle = '#111';
        }
        ctx.fillRect(mx * CELL, my * CELL, CELL - 1, CELL - 1);
      }
    }
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.canvas = null;
  }

  isOpen(): boolean { return this.overlay !== null; }

  destroy(): void { this.close(); }
}
