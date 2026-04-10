export class CheatsheetPanel {
  private el: HTMLDivElement | null = null;

  toggle(): void {
    if (this.el) { this.close(); } else { this.open(); }
  }

  open(): void {
    if (this.el) return;
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:20px;z-index:600;color:#eee;
      font:12px monospace;min-width:560px;max-width:680px;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:15px;font-weight:bold;color:#e2b96f">📖 조작 가이드</span>
        <button id="cheatsheet-x" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="color:#7a9;font-size:10px;padding:4px 0;border-bottom:1px solid #334;margin-bottom:6px">이동</div>
          <div>↑↓←→ &nbsp; 캐릭터 이동</div>
          <div style="margin-top:8px;color:#7a9;font-size:10px;padding:4px 0;border-bottom:1px solid #334;margin-bottom:6px">단축키</div>
          <div>V &nbsp;&nbsp;&nbsp; 인벤토리</div>
          <div>B &nbsp;&nbsp;&nbsp; 건설 패널</div>
          <div>E &nbsp;&nbsp;&nbsp; 장비 패널</div>
          <div>H &nbsp;&nbsp;&nbsp; 이 도움말</div>
          <div>M &nbsp;&nbsp;&nbsp; 미니맵</div>
          <div>Tab &nbsp; 플레이어 목록</div>
          <div>ESC &nbsp; 일시정지</div>
        </div>
        <div>
          <div style="color:#7a9;font-size:10px;padding:4px 0;border-bottom:1px solid #334;margin-bottom:6px">상호작용</div>
          <div>클릭 &nbsp;&nbsp;&nbsp; 대상 상호작용</div>
          <div>우클릭 &nbsp; 컨텍스트 메뉴</div>
          <div style="margin-top:8px;color:#7a9;font-size:10px;padding:4px 0;border-bottom:1px solid #334;margin-bottom:6px">생존 수치</div>
          <div>❤ HP &nbsp;&nbsp; 전투/기아 시 감소</div>
          <div>🍖 허기 &nbsp; 시간 감소</div>
          <div>😴 피로 &nbsp; 시간 감소</div>
          <div>⚡ 행동 &nbsp; 무위 시 감소</div>
        </div>
        <div>
          <div style="color:#7a9;font-size:10px;padding:4px 0;border-bottom:1px solid #334;margin-bottom:6px">자원 획득</div>
          <div>🪓 나무 클릭 → 목재</div>
          <div>⛏ 암반 클릭 → 암석</div>
          <div>🎣 물 클릭 → 물고기</div>
        </div>
        <div>
          <div style="color:#7a9;font-size:10px;padding:4px 0;border-bottom:1px solid #334;margin-bottom:6px">위험 & 팁</div>
          <div>허기 0 → 최대HP 감소</div>
          <div>피로 0 → 강제 수면</div>
          <div>행동 0 → 광란 30초</div>
          <div style="margin-top:6px;color:#fc8">날것은 식중독 위험!</div>
          <div style="color:#fc8">침대는 실내에서 더 효과적</div>
          <div style="color:#fc8">암반은 재생 안 됨</div>
        </div>
      </div>
    `;

    panel.querySelector('#cheatsheet-x')!.addEventListener('click', () => this.close());

    const closeOnOutside = (e: MouseEvent) => {
      if (!panel.contains(e.target as Node)) {
        this.close();
        document.removeEventListener('mousedown', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);

    document.body.appendChild(panel);
    this.el = panel;
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }

  isOpen(): boolean { return this.el !== null; }
}
