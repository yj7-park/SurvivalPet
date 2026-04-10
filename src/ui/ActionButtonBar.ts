export type ActionKey = 'interact' | 'inventory' | 'equipment' | 'build' | 'help';

const BUTTON_DEFS: { key: ActionKey; icon: string; label: string; size: number }[] = [
  { key: 'interact',   icon: '⚔',  label: '행동',    size: 36 },
  { key: 'inventory',  icon: '🎒', label: '인벤토리', size: 28 },
  { key: 'equipment',  icon: '🛡', label: '장비',    size: 28 },
  { key: 'build',      icon: '🔨', label: '건설',    size: 28 },
  { key: 'help',       icon: '?',  label: '도움말',  size: 28 },
];

export class ActionButtonBar {
  private container: HTMLDivElement;
  private pressedKeys = new Set<ActionKey>();
  private onPress: (key: ActionKey) => void;

  constructor(onPress: (key: ActionKey) => void) {
    this.onPress = onPress;
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position:fixed; right:0; bottom:0; z-index:500;
      width:180px; height:180px; pointer-events:none;
    `;

    const positions: Record<ActionKey, { right: number; bottom: number }> = {
      interact:  { right: 72,  bottom: 80  },
      inventory: { right: 148, bottom: 80  },
      equipment: { right: 72,  bottom: 156 },
      build:     { right: 148, bottom: 156 },
      help:      { right: 220, bottom: 80  },
    };

    for (const def of BUTTON_DEFS) {
      const pos = positions[def.key];
      const btn = document.createElement('div');
      btn.style.cssText = `
        position:fixed; right:${pos.right}px; bottom:${pos.bottom}px;
        width:${def.size * 2}px; height:${def.size * 2}px;
        border-radius:50%; background:rgba(0,0,0,0.55);
        border:1px solid rgba(255,255,255,0.4);
        display:flex; align-items:center; justify-content:center;
        font-size:${def.size * 0.8}px; color:#fff;
        pointer-events:auto; user-select:none;
        transition:background 0.1s;
        touch-action:manipulation;
      `;
      btn.textContent = def.icon;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btn.style.background = 'rgba(255,255,255,0.2)';
        this.pressedKeys.add(def.key);
        this.onPress(def.key);
      }, { passive: false });
      btn.addEventListener('touchend', () => {
        btn.style.background = 'rgba(0,0,0,0.55)';
        this.pressedKeys.delete(def.key);
      });
      document.body.appendChild(btn);
      this.container.appendChild(btn);
    }

    document.body.appendChild(this.container);
  }

  isPressed(key: ActionKey): boolean { return this.pressedKeys.has(key); }

  destroy(): void {
    this.container.remove();
  }
}
