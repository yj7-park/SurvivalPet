import { generateSeed } from '../utils/seedRandom';
import { MultiplayerSystem } from '../systems/MultiplayerSystem';
import { MapGenerator, TileType } from '../world/MapGenerator';

const MINIMAP_COLORS: Record<string, string> = {
  [TileType.Dirt]:  '#b89060',
  [TileType.Water]: '#4a88c0',
  [TileType.Rock]:  '#707878',
  [TileType.Tree]:  '#3a6820',
};

function generateMapThumbnail(seed: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  const scale = 80 / 100;

  const mapGen = new MapGenerator(seed);
  const mapData = mapGen.generateMap(0, 0);
  mapData.tiles.forEach((row, ty) => {
    row.forEach((tile, tx) => {
      ctx.fillStyle = MINIMAP_COLORS[tile] ?? '#b89060';
      ctx.fillRect(
        Math.floor(tx * scale), Math.floor(ty * scale),
        Math.ceil(scale), Math.ceil(scale),
      );
    });
  });

  ctx.strokeStyle = '#5a4020';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 80, 80);
  return canvas;
}

export class SeedInputScreen {
  private overlay: HTMLDivElement | null = null;

  open(onNext: (seed: string, isMultiplayer: boolean) => void, onBack: () => void): void {
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
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input id="si-seed" type="text" maxlength="12" value="${randomSeed}"
          style="flex:1;padding:10px;font:14px monospace;background:#0f1923;
                 color:#e8d5b0;border:1px solid #446;border-radius:4px;outline:none" />
        <button id="si-rand" style="padding:8px 12px;background:#2a3a4a;color:#adf;
                 border:1px solid #446;border-radius:4px;cursor:pointer;font:11px monospace">
          🎲 랜덤
        </button>
      </div>
      <div style="color:#668;font-size:11px;margin-bottom:4px">
        같은 Seed = 같은 맵이 생성됩니다
      </div>
      <div id="si-count" style="color:#8ac;font-size:11px;margin-bottom:8px;min-height:16px"></div>

      <div id="si-preview-wrap" style="margin-bottom:14px;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div id="si-preview-label" style="color:#668;font-size:11px;align-self:flex-start">맵 미리보기</div>
        <div id="si-preview-container"
          style="width:80px;height:80px;background:#0a1020;border:1px solid #334;border-radius:2px;overflow:hidden">
        </div>
        <div id="si-preview-info" style="color:#8ac;font-size:11px"></div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="si-solo" style="padding:10px 18px;background:#2a6e4a;color:#fff;
                 border:none;border-radius:4px;cursor:pointer;font:12px monospace">
          혼자 플레이 →
        </button>
        <button id="si-multi" style="padding:10px 18px;background:#4a4a8a;color:#adf;
                 border:1px solid #446;border-radius:4px;cursor:pointer;font:12px monospace">
          멀티플레이 →
        </button>
      </div>
    `;

    const seedInput = overlay.querySelector<HTMLInputElement>('#si-seed')!;
    const countDiv = overlay.querySelector<HTMLDivElement>('#si-count')!;
    const previewContainer = overlay.querySelector<HTMLDivElement>('#si-preview-container')!;
    const previewInfo = overlay.querySelector<HTMLDivElement>('#si-preview-info')!;

    // Map thumbnail (debounced 500ms)
    let previewTimeout: ReturnType<typeof setTimeout> | null = null;
    const updatePreview = () => {
      const raw = seedInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const seed = raw || 'random';
      previewInfo.textContent = `씨드: ${seed}`;
      setTimeout(() => {
        const canvas = generateMapThumbnail(seed);
        canvas.style.cssText = 'image-rendering:pixelated;display:block;width:80px;height:80px';
        previewContainer.innerHTML = '';
        previewContainer.appendChild(canvas);
      }, 0);
    };

    // Player count (debounced)
    let countTimeout: ReturnType<typeof setTimeout> | null = null;
    const refreshCount = () => {
      const seed = seedInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seed) { countDiv.textContent = ''; return; }
      MultiplayerSystem.getPlayerCount(seed).then(n => {
        if (n > 0) countDiv.textContent = `현재 이 Seed의 접속자: ${n}명`;
        else countDiv.textContent = '';
      });
    };

    seedInput.addEventListener('input', () => {
      if (previewTimeout) clearTimeout(previewTimeout);
      previewTimeout = setTimeout(updatePreview, 500);

      if (countTimeout) clearTimeout(countTimeout);
      countTimeout = setTimeout(refreshCount, 600);
    });

    setTimeout(updatePreview, 100);
    setTimeout(refreshCount, 300);

    overlay.querySelector('#si-x')!.addEventListener('click', () => {
      this.close();
      onBack();
    });

    overlay.querySelector('#si-rand')!.addEventListener('click', () => {
      seedInput.value = generateSeed();
      if (previewTimeout) clearTimeout(previewTimeout);
      previewTimeout = setTimeout(updatePreview, 200);
      refreshCount();
    });

    const getSeed = () => {
      let seed = seedInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seed) seed = generateSeed();
      return seed;
    };

    overlay.querySelector('#si-solo')!.addEventListener('click', () => {
      this.close();
      onNext(getSeed(), false);
    });
    overlay.querySelector('#si-multi')!.addEventListener('click', () => {
      this.close();
      onNext(getSeed(), true);
    });

    seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onNext(getSeed(), false);
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
