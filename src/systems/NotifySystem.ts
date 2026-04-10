export type NotifyType = 'info' | 'warning' | 'danger' | 'success' | 'loot';

const TYPE_CONFIG: Record<NotifyType, { icon: string; barColor: string; textColor: string; durationMs: number }> = {
  info:    { icon: 'ℹ',  barColor: '#5599ff', textColor: '#ffffff', durationMs: 3000 },
  warning: { icon: '⚠',  barColor: '#ffcc00', textColor: '#ffee44', durationMs: 4000 },
  danger:  { icon: '❗',  barColor: '#ff4444', textColor: '#ff8888', durationMs: 4000 },
  success: { icon: '✅',  barColor: '#44cc66', textColor: '#aaffaa', durationMs: 2500 },
  loot:    { icon: '🎒',  barColor: '#44ccff', textColor: '#88eeff', durationMs: 2500 },
};

const SLIDE_DURATION_MS = 200;
const FADE_DURATION_MS = 400;
const MAX_TOASTS = 5;

interface Toast {
  id: string;
  message: string;
  type: NotifyType;
  timeLeft: number;
  slideProgress: number; // 0→1 slide in
  fadeProgress: number;  // 1→0 fade out
  el: HTMLDivElement;
}

export interface LogEntry {
  gameTime: string;
  message: string;
  type: NotifyType;
}

export class NotifySystem {
  private toasts: Toast[] = [];
  private logEntries: LogEntry[] = [];
  private container: HTMLDivElement;
  private nextId = 0;
  private getGameTime: () => string;

  constructor(getGameTime: () => string) {
    this.getGameTime = getGameTime;
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position:fixed; top:60px; right:10px; z-index:400;
      display:flex; flex-direction:column; gap:4px; pointer-events:none;
      width:230px;
    `;
    document.body.appendChild(this.container);
  }

  show(message: string, type: NotifyType = 'info'): void {
    // Remove existing if > MAX_TOASTS
    if (this.toasts.length >= MAX_TOASTS) {
      const oldest = this.toasts.shift()!;
      oldest.el.remove();
    }

    const cfg = TYPE_CONFIG[type];
    const id = String(this.nextId++);

    const el = document.createElement('div');
    el.style.cssText = `
      width:220px; height:28px; line-height:28px;
      background:rgba(0,0,0,0.82);
      border-left:4px solid ${cfg.barColor};
      border-radius:3px; padding:0 8px;
      font:11px monospace; color:${cfg.textColor};
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      transform:translateX(240px); opacity:1;
      transition:transform ${SLIDE_DURATION_MS}ms ease-out;
    `;
    el.textContent = `${cfg.icon} ${message}`;
    this.container.appendChild(el);

    // Trigger slide in
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
    });

    const toast: Toast = {
      id, message, type,
      timeLeft: cfg.durationMs,
      slideProgress: 0,
      fadeProgress: 1,
      el,
    };
    this.toasts.push(toast);

    // Log entry
    this.logEntries.unshift({ gameTime: this.getGameTime(), message, type });
    if (this.logEntries.length > 50) this.logEntries.pop();
  }

  showOnce(message: string, type: NotifyType): void {
    const already = this.toasts.find(t => t.message === message);
    if (already) {
      already.timeLeft = TYPE_CONFIG[type].durationMs;
      return;
    }
    this.show(message, type);
  }

  /** Shorthand for GameScene compatibility — wraps show() with color-to-type mapping */
  showByColor(message: string, color: string): void {
    let type: NotifyType = 'info';
    if (color === '#aaffaa' || color === '#88ffaa') type = 'success';
    else if (color === '#ffee44' || color === '#ffcc00') type = 'warning';
    else if (color === '#ff4444' || color === '#cc2222' || color === '#ff8844') type = 'danger';
    else if (color === '#aaddff' || color === '#88eeff') type = 'loot';
    this.show(message, type);
  }

  getLog(): LogEntry[] { return this.logEntries; }

  update(delta: number): void {
    const toRemove: Toast[] = [];
    for (const toast of this.toasts) {
      toast.timeLeft -= delta;
      if (toast.timeLeft <= 0) {
        // Fade out
        toast.fadeProgress = Math.max(0, toast.fadeProgress - delta / FADE_DURATION_MS);
        toast.el.style.opacity = String(toast.fadeProgress);
        if (toast.fadeProgress <= 0) {
          toRemove.push(toast);
        }
      }
    }
    for (const t of toRemove) {
      t.el.remove();
      this.toasts = this.toasts.filter(x => x !== t);
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
