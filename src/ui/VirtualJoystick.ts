export interface JoystickState {
  active: boolean;
  dx: number;
  dy: number;
  magnitude: number;
}

const OUTER_RADIUS = 56;
const HANDLE_RADIUS = 24;

export class VirtualJoystick {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: JoystickState = { active: false, dx: 0, dy: 0, magnitude: 0 };
  private originX = 0;
  private originY = 0;
  private handleX = 0;
  private handleY = 0;
  private activeTouchId: number | null = null;
  private visible = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position:fixed; pointer-events:none; z-index:500; opacity:0;
      transition:opacity 0.15s; left:0; top:0;
    `;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d')!;
    document.body.appendChild(this.canvas);

    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  }

  handleTouchStart(touch: Touch): void {
    if (this.activeTouchId !== null) return;
    this.activeTouchId = touch.identifier;
    this.originX = touch.clientX;
    this.originY = touch.clientY;
    this.handleX = touch.clientX;
    this.handleY = touch.clientY;
    this.state.active = true;
    this.visible = true;
    this.canvas.style.opacity = '1';
    this.draw();
  }

  handleTouchMove(touch: Touch): void {
    if (touch.identifier !== this.activeTouchId) return;
    const dx = touch.clientX - this.originX;
    const dy = touch.clientY - this.originY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, OUTER_RADIUS);
    const angle = Math.atan2(dy, dx);
    this.handleX = this.originX + Math.cos(angle) * clamped;
    this.handleY = this.originY + Math.sin(angle) * clamped;
    this.state.dx = dx / OUTER_RADIUS;
    this.state.dy = dy / OUTER_RADIUS;
    const mag = Math.min(1, dist / OUTER_RADIUS);
    this.state.magnitude = mag;
    // Clamp direction
    if (dist > 0) {
      this.state.dx = (Math.cos(angle) * mag);
      this.state.dy = (Math.sin(angle) * mag);
    }
    this.draw();
  }

  handleTouchEnd(touchId: number): void {
    if (touchId !== this.activeTouchId) return;
    this.activeTouchId = null;
    this.state = { active: false, dx: 0, dy: 0, magnitude: 0 };
    this.visible = false;
    this.canvas.style.opacity = '0';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getState(): JoystickState { return this.state; }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.visible) return;

    // Outer circle
    ctx.beginPath();
    ctx.arc(this.originX, this.originY, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Handle
    ctx.beginPath();
    ctx.arc(this.handleX, this.handleY, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  destroy(): void {
    this.canvas.remove();
  }
}
