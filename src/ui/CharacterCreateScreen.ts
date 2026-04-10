import { drawCharacterCanvas, CHAR_PALETTES } from '../world/SpriteGenerator';

type StatKey = 'str' | 'agi' | 'con' | 'int';

interface Stats { str: number; agi: number; con: number; int: number }

export interface CharacterData {
  name: string;
  appearance: number;
  stats: Stats;
}

function adjustStat(stats: Stats, target: StatKey, delta: 1 | -1): Stats {
  const newVal = stats[target] + delta;
  if (newVal < 2 || newVal > 10) return stats;

  const others = (['str', 'agi', 'con', 'int'] as StatKey[]).filter(k => k !== target).filter(k => {
    const v = stats[k] - delta;
    return v >= 2 && v <= 10;
  });
  if (others.length === 0) return stats;

  const pivot = delta === 1
    ? others.reduce((a, b) => stats[a] >= stats[b] ? a : b)
    : others.reduce((a, b) => stats[a] <= stats[b] ? a : b);

  return { ...stats, [target]: newVal, [pivot]: stats[pivot] - delta };
}

function derivedStats(s: Stats): string[] {
  const speed = 120 + (s.agi - 5) * 12;
  const hp = 80 + s.con * 8;
  const fish = Math.min(95, 40 + s.agi * 4 + s.int * 3);
  const log = Math.max(2, 5 - (s.str - 5) * 0.4).toFixed(1);
  const mine = Math.max(3, 8 - (s.str - 5) * 0.6).toFixed(1);
  return [
    `이동속도 ${speed}px/s`,
    `최대HP ${hp}`,
    `낚시 ${fish}%`,
    `벌목 ${log}s`,
    `채굴 ${mine}s`,
  ];
}

function buildPreviewCanvas(paletteIdx: number): HTMLCanvasElement {
  const src = drawCharacterCanvas(paletteIdx);
  const dst = document.createElement('canvas');
  const scale = 3;
  dst.width = 32 * scale;
  dst.height = 32 * scale;
  const ctx = dst.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, 32 * scale, 32 * scale);
  dst.style.cssText = `
    display:block;border:2px solid #446;border-radius:4px;
    background:#0a1a0a;image-rendering:pixelated;
  `;
  return dst;
}

export class CharacterCreateScreen {
  private overlay: HTMLDivElement | null = null;
  private stats: Stats = { str: 5, agi: 5, con: 5, int: 5 };
  private appearance = 0;
  private nameValue = '생존자';

  open(onStart: (data: CharacterData) => void, onBack: () => void): void {
    this.close();
    this.stats = { str: 5, agi: 5, con: 5, int: 5 };
    this.appearance = 0;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:24px;z-index:500;color:#eee;
      font:13px monospace;min-width:380px;max-height:90vh;overflow-y:auto;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:18px';
    header.innerHTML = `
      <button id="cc-back" style="background:none;border:none;color:#aaa;cursor:pointer;font:13px monospace">← 뒤</button>
      <span style="font-size:15px;font-weight:bold;color:#e2b96f">캐릭터 생성</span>
      <span style="width:40px"></span>
    `;
    overlay.appendChild(header);

    // Name input
    const nameSection = document.createElement('div');
    nameSection.style.marginBottom = '14px';
    nameSection.innerHTML = `
      <div style="color:#9ab;font-size:11px;margin-bottom:6px">이름 (최대 12자)</div>
      <input id="cc-name" type="text" maxlength="12" value="${this.nameValue}"
        style="width:100%;box-sizing:border-box;padding:8px;font:13px monospace;
               background:#0f1923;color:#e8d5b0;border:1px solid #446;
               border-radius:4px;outline:none" />
    `;
    overlay.appendChild(nameSection);

    // Appearance
    const appSection = document.createElement('div');
    appSection.style.marginBottom = '14px';
    appSection.innerHTML = `<div style="color:#9ab;font-size:11px;margin-bottom:8px">외형</div>`;

    const appRow = document.createElement('div');
    appRow.style.cssText = 'display:flex;align-items:center;gap:12px';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = 'background:#2a3a4a;color:#adf;border:1px solid #446;border-radius:4px;padding:6px 10px;cursor:pointer;font:14px monospace';

    const previewCanvas = buildPreviewCanvas(this.appearance);

    const appLabel = document.createElement('div');
    appLabel.style.cssText = 'color:#aaa;font-size:11px;text-align:center;min-width:60px';
    const getAppLabel = () => ['스타일 1', '스타일 2', '스타일 3'][this.appearance];
    appLabel.textContent = getAppLabel();

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = prevBtn.style.cssText;

    const updatePreview = () => {
      const src = drawCharacterCanvas(this.appearance);
      const ctx = previewCanvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.drawImage(src, 0, 0, previewCanvas.width, previewCanvas.height);
      appLabel.textContent = getAppLabel();
    };

    prevBtn.onclick = () => {
      this.appearance = (this.appearance + CHAR_PALETTES.length - 1) % CHAR_PALETTES.length;
      updatePreview();
    };
    nextBtn.onclick = () => {
      this.appearance = (this.appearance + 1) % CHAR_PALETTES.length;
      updatePreview();
    };

    appRow.appendChild(prevBtn);
    appRow.appendChild(previewCanvas);
    appRow.appendChild(appLabel);
    appRow.appendChild(nextBtn);
    appSection.appendChild(appRow);
    overlay.appendChild(appSection);

    // Stats
    const statsSection = document.createElement('div');
    statsSection.style.marginBottom = '14px';
    statsSection.innerHTML = `<div style="color:#9ab;font-size:11px;margin-bottom:8px">능력치 배분 (총합 20, 각 2~10)</div>`;

    const statRows: Record<StatKey, HTMLElement> = {} as Record<StatKey, HTMLElement>;
    const statLabels: Record<StatKey, string> = { str: '힘  (STR)', agi: '민첩 (AGI)', con: '체력 (CON)', int: '지능 (INT)' };

    const updateStatDisplay = () => {
      (Object.keys(statRows) as StatKey[]).forEach(k => {
        const row = statRows[k];
        const val = this.stats[k];
        row.querySelector<HTMLElement>('.stat-val')!.textContent = String(val);
        const bar = row.querySelector<HTMLElement>('.stat-bar-fill')!;
        bar.style.width = `${((val - 2) / 8) * 100}%`;
      });
      derivedEl.innerHTML = derivedStats(this.stats).map(s => `<span style="margin-right:12px">${s}</span>`).join('');
    };

    (Object.entries(statLabels) as [StatKey, string][]).forEach(([key, label]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1a2030';

      row.innerHTML = `
        <span style="min-width:90px;color:#bbb;font-size:11px">${label}</span>
        <button class="stat-dec" style="width:22px;height:22px;background:#2a3a4a;color:#adf;border:1px solid #446;border-radius:3px;cursor:pointer;font:12px monospace">−</button>
        <div style="flex:1;height:8px;background:#222;border-radius:4px;overflow:hidden">
          <div class="stat-bar-fill" style="height:100%;background:#4a8acc;border-radius:4px;transition:width 0.1s;width:${((this.stats[key] - 2) / 8) * 100}%"></div>
        </div>
        <span class="stat-val" style="min-width:20px;text-align:center;color:#fff;font-weight:bold">${this.stats[key]}</span>
        <button class="stat-inc" style="width:22px;height:22px;background:#2a3a4a;color:#adf;border:1px solid #446;border-radius:3px;cursor:pointer;font:12px monospace">+</button>
      `;

      row.querySelector('.stat-dec')!.addEventListener('click', () => {
        this.stats = adjustStat(this.stats, key, -1);
        updateStatDisplay();
      });
      row.querySelector('.stat-inc')!.addEventListener('click', () => {
        this.stats = adjustStat(this.stats, key, 1);
        updateStatDisplay();
      });

      statRows[key] = row;
      statsSection.appendChild(row);
    });
    overlay.appendChild(statsSection);

    // Derived stats
    const derivedSection = document.createElement('div');
    derivedSection.style.marginBottom = '18px';
    derivedSection.innerHTML = `<div style="color:#9ab;font-size:11px;margin-bottom:6px">파생 스탯 미리보기</div>`;
    const derivedEl = document.createElement('div');
    derivedEl.style.cssText = 'color:#8cc;font-size:11px;line-height:1.8;flex-wrap:wrap;display:flex';
    derivedEl.innerHTML = derivedStats(this.stats).map(s => `<span style="margin-right:12px">${s}</span>`).join('');
    derivedSection.appendChild(derivedEl);
    overlay.appendChild(derivedSection);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.textContent = '게임 시작!';
    startBtn.style.cssText = `
      width:100%;padding:12px;background:#2a6e4a;color:#fff;
      border:none;border-radius:4px;cursor:pointer;font:14px monospace;font-weight:bold;
    `;
    startBtn.onmouseenter = () => (startBtn.style.opacity = '0.85');
    startBtn.onmouseleave = () => (startBtn.style.opacity = '1');
    startBtn.onclick = () => {
      const nameEl = overlay.querySelector<HTMLInputElement>('#cc-name')!;
      let name = nameEl.value.trim().replace(/[^\wㄱ-힣\s]/g, '').substring(0, 12);
      if (!name) {
        nameEl.style.borderColor = '#f66';
        nameEl.focus();
        return;
      }
      this.nameValue = name;
      this.close();
      onStart({ name, appearance: this.appearance, stats: { ...this.stats } });
    };
    overlay.appendChild(startBtn);

    overlay.querySelector('#cc-back')!.addEventListener('click', () => {
      this.close();
      onBack();
    });

    document.body.appendChild(overlay);
    this.overlay = overlay;
    overlay.querySelector<HTMLInputElement>('#cc-name')!.focus();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
