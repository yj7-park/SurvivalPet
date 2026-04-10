import { Season } from '../systems/GameTime';
import { UI_COLORS } from '../config/uiColors';

const SEASON_CARDS: Record<Season, { icon: string; title: string; sub: string }> = {
  spring: { icon: '🌸', title: '봄이 왔습니다',    sub: '따뜻한 바람과 함께 새로운 시작' },
  summer: { icon: '☀',  title: '여름이 되었습니다', sub: '뜨거운 햇살, 자원이 풍부한 계절' },
  autumn: { icon: '🍂', title: '가을이 되었습니다', sub: '수확의 계절, 겨울을 준비하세요' },
  winter: { icon: '❄',  title: '겨울이 왔습니다',  sub: '혹독한 추위, 충분한 연료를 비축하세요' },
};

export class SeasonCard {
  private el: HTMLDivElement | null = null;

  show(season: Season): void {
    this.hide();
    const card = SEASON_CARDS[season];
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; top:80px; left:50%; transform:translateX(-50%);
      background:${UI_COLORS.panelBg}; border:1px solid ${UI_COLORS.panelBorder};
      border-radius:8px; padding:16px 28px; z-index:400;
      font:11px 'Courier New',monospace; color:${UI_COLORS.textPrimary};
      text-align:center; min-width:280px; pointer-events:none;
      opacity:0; transition:opacity 0.5s ease;
    `;
    el.innerHTML = `
      <div style="font-size:20px;margin-bottom:8px">${card.icon} ${card.title}</div>
      <div style="color:${UI_COLORS.textSecondary};font-size:10px">${card.sub}</div>
    `;
    document.body.appendChild(el);
    this.el = el;

    // Fade in
    requestAnimationFrame(() => { el.style.opacity = '1'; });

    // Stay 2s then fade out
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => this.hide(), 500);
    }, 2500);
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }

  destroy(): void { this.hide(); }
}
