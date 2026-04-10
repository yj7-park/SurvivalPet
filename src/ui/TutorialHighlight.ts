/**
 * Renders a pulsing yellow border highlight over a canvas-space rectangle.
 * Coordinates should be in screen pixels (camera-projected).
 */
export class TutorialHighlight {
  private el: HTMLDivElement | null = null;
  private arrow: HTMLDivElement | null = null;
  private animId = 0;

  show(screenX: number, screenY: number, size = 32): void {
    this.hide();

    // Highlight box
    const box = document.createElement('div');
    box.style.cssText = `
      position:fixed;
      left:${screenX - size / 2}px;top:${screenY - size / 2}px;
      width:${size}px;height:${size}px;
      border:2px solid #ffe040;border-radius:3px;
      z-index:490;pointer-events:none;
      box-shadow:0 0 8px #ffe040;
    `;
    document.body.appendChild(box);
    this.el = box;

    // Arrow above
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position:fixed;
      left:${screenX - 8}px;top:${screenY - size / 2 - 22}px;
      font-size:16px;z-index:491;pointer-events:none;
      color:#ffe040;text-shadow:0 0 4px #ffe040;
    `;
    arrow.textContent = '▼';
    document.body.appendChild(arrow);
    this.arrow = arrow;

    // Pulse animation
    let t = 0;
    const animate = () => {
      t += 0.05;
      const alpha = 0.5 + Math.abs(Math.sin(t)) * 0.5;
      if (box.isConnected) {
        box.style.opacity = String(alpha);
        this.animId = requestAnimationFrame(animate);
      }
    };
    this.animId = requestAnimationFrame(animate);
  }

  hide(): void {
    cancelAnimationFrame(this.animId);
    this.el?.remove();
    this.arrow?.remove();
    this.el = null;
    this.arrow = null;
  }
}
