import { generateSeed } from '../utils/seedRandom';

export class SeedInputScreen {
  private overlay: HTMLDivElement | null = null;

  open(onNext: (seed: string) => void, onBack: () => void): void {
    this.close();

    const randomSeed = generateSeed();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:24px;z-index:500;color:#eee;
      font:13px monospace;min-width:340px;
    `;

    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <span style="font-size:15px;font-weight:bold;color:#e2b96f">새 게임</span>
        <button id="si-x" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px">✕</button>
      </div>

      <div style="margin-bottom:6px;color:#9ab;font-size:11px">월드 Seed</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="si-seed" type="text" maxlength="12" value="${randomSeed}"
          style="flex:1;padding:10px;font:14px monospace;background:#0f1923;
                 color:#e8d5b0;border:1px solid #446;border-radius:4px;outline:none" />
        <button id="si-rand" style="padding:8px 12px;background:#2a3a4a;color:#adf;
                 border:1px solid #446;border-radius:4px;cursor:pointer;font:11px monospace">
          🎲 랜덤
        </button>
      </div>
      <div style="color:#668;font-size:11px;margin-bottom:20px">
        같은 Seed = 같은 맵이 생성됩니다
      </div>

      <div style="display:flex;justify-content:flex-end">
        <button id="si-next" style="padding:10px 24px;background:#2a6e4a;color:#fff;
                 border:none;border-radius:4px;cursor:pointer;font:13px monospace">
          다음 →
        </button>
      </div>
    `;

    const seedInput = overlay.querySelector<HTMLInputElement>('#si-seed')!;

    overlay.querySelector('#si-x')!.addEventListener('click', () => {
      this.close();
      onBack();
    });

    overlay.querySelector('#si-rand')!.addEventListener('click', () => {
      seedInput.value = generateSeed();
    });

    overlay.querySelector('#si-next')!.addEventListener('click', () => {
      let seed = seedInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seed) seed = generateSeed();
      this.close();
      onNext(seed);
    });

    seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (overlay.querySelector('#si-next') as HTMLButtonElement).click();
    });

    document.body.appendChild(overlay);
    this.overlay = overlay;
    seedInput.focus();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
