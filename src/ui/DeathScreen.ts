export class DeathScreen {
  private overlay: HTMLDivElement | null = null;

  show(opts: {
    playtimeMs: number;
    enemiesKilled: number;
    buildingsBuilt: number;
    onReturnToTitle: () => void;
  }): void {
    if (this.overlay) return;

    const days = Math.floor(opts.playtimeMs / 1_800_000);
    const remainMs = opts.playtimeMs % 1_800_000;
    const hours = Math.floor(remainMs / 75_000); // 1 game hour = 75s real
    const mins  = Math.floor((remainMs % 75_000) / 1_250); // 1 game min ~= 1.25s

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.88);z-index:500;
      display:flex;align-items:center;justify-content:center;
      pointer-events:all;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:rgba(15,5,5,0.97);border:1px solid #662222;
      border-radius:10px;padding:36px 48px;color:#eee;
      font:13px monospace;min-width:320px;text-align:center;
    `;

    box.innerHTML = `
      <div style="font-size:28px;margin-bottom:20px">💀 사망했습니다</div>
      <div style="color:#aaa;margin-bottom:6px">생존: ${days}일 ${hours}시간 ${mins}분</div>
      <div style="color:#aaa;margin-bottom:6px">처치한 적: ${opts.enemiesKilled}마리</div>
      <div style="color:#aaa;margin-bottom:20px">건설한 구조물: ${opts.buildingsBuilt}개</div>
    `;

    const btn = document.createElement('button');
    btn.textContent = '타이틀로 돌아가기';
    btn.style.cssText = `
      padding:10px 24px;background:#3a1515;color:#ffaaaa;border:1px solid #662222;
      border-radius:5px;cursor:pointer;font:13px monospace;
    `;
    btn.onmouseenter = () => { btn.style.background = '#5a2020'; };
    btn.onmouseleave = () => { btn.style.background = '#3a1515'; };
    btn.onclick = () => opts.onReturnToTitle();
    box.appendChild(btn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  isVisible(): boolean { return this.overlay !== null; }

  destroy(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
