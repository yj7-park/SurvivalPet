import { MultiplayerSystem, RemotePlayerState } from '../systems/MultiplayerSystem';

export class PlayerListPanel {
  private overlay: HTMLDivElement | null = null;

  constructor(
    private multiplayerSys: MultiplayerSystem,
    private localName: string,
    private localHp: () => number,
    private localHunger: () => number,
  ) {}

  toggle(): void {
    if (this.overlay) { this.close(); } else { this.open(); }
  }

  open(): void {
    if (this.overlay) return;
    this.render();
  }

  updateAndRefresh(): void {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    this.render();
  }

  private render(): void {
    const remotes = this.multiplayerSys.getAllRemotePlayers();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:60px;right:16px;
      background:rgba(5,10,20,0.92);border:1px solid #446;
      border-radius:6px;padding:10px;z-index:200;color:#eee;
      font:12px monospace;min-width:220px;
    `;

    overlay.innerHTML = `
      <div style="font-size:12px;font-weight:bold;color:#e2b96f;margin-bottom:8px">
        접속자 (${remotes.length + 1}명)
      </div>
    `;

    // Local player
    const localRow = this.makeRow(`★ ${this.localName}`, this.localHp(), this.localHunger(), false);
    overlay.appendChild(localRow);

    // Remote players
    for (const p of remotes) {
      overlay.appendChild(this.makeRow(p.name, p.hp, p.hunger, p.frenzy));
    }

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private makeRow(name: string, hp: number, hunger: number, frenzy: boolean): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      padding:4px 6px;border-radius:3px;margin-bottom:3px;
      background:${frenzy ? 'rgba(80,0,0,0.6)' : 'transparent'};
    `;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `👤 ${name}`;
    nameSpan.style.cssText = `color:${frenzy ? '#ff6666' : '#ccc'};max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;

    const statsSpan = document.createElement('span');
    statsSpan.style.color = '#888';
    statsSpan.innerHTML = `❤${Math.ceil(hp)} 🍖${Math.ceil(hunger)}${frenzy ? ' ⚡' : ''}`;

    row.appendChild(nameSpan);
    row.appendChild(statsSpan);
    return row;
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  isOpen(): boolean { return this.overlay !== null; }

  destroy(): void { this.close(); }
}
