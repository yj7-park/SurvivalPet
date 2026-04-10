import type { CampfireSystem, Campfire } from '../systems/CampfireSystem';
import type { Inventory } from '../systems/Inventory';

const FUEL_DURATION_PER_WOOD_MS = 3 * 60 * 1000;

export type CampfireCookRecipe = {
  id: string;
  name: string;
  icon: string;
  inputItem: string;
  outputItem: string;
  cookTimeSec: number;
};

export const CAMPFIRE_RECIPES: CampfireCookRecipe[] = [
  { id: 'grill_fish', name: '생선 굽기', icon: '🐟', inputItem: 'item_raw_fish', outputItem: 'item_cooked_fish', cookTimeSec: 10 },
  { id: 'grill_meat', name: '고기 굽기', icon: '🥩', inputItem: 'item_raw_meat', outputItem: 'item_cooked_meat', cookTimeSec: 10 },
];

export class CampfirePanel {
  private panel: HTMLDivElement | null = null;
  private activeCampfireId: string | null = null;

  constructor(
    private campfireSystem: CampfireSystem,
    private inventory: Inventory,
    private playerX: () => number,
    private playerY: () => number,
    private onCook: (recipe: CampfireCookRecipe, campfireId: string) => void,
    private onNotify: (msg: string, color: string) => void,
  ) {}

  open(campfireId: string): void {
    this.close();
    this.activeCampfireId = campfireId;
    this.render();
  }

  close(): void {
    this.panel?.remove();
    this.panel = null;
    this.activeCampfireId = null;
  }

  isOpen(): boolean { return this.panel !== null; }
  getActiveCampfireId(): string | null { return this.activeCampfireId; }

  private render(): void {
    if (!this.activeCampfireId) return;
    const cf = this.campfireSystem.get(this.activeCampfireId);
    if (!cf) { this.close(); return; }

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
      width:280px; background:rgba(20,12,5,0.95); border:1px solid #c86400;
      border-radius:6px; padding:10px; z-index:300; color:#eee; font:12px monospace;
    `;
    this.panel = panel;

    const fuelSec = Math.max(0, cf.fuelMs / 1000);
    const fuelMin = Math.floor(fuelSec / 60);
    const fuelSecR = Math.floor(fuelSec % 60);
    const fuelPct = Math.min(1, cf.fuelMs / (9 * FUEL_DURATION_PER_WOOD_MS));
    const barFull = 20;
    const barFilled = Math.round(barPct(fuelPct) * barFull);
    const bar = '█'.repeat(barFilled) + '░'.repeat(barFull - barFilled);

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#ff9933;font-weight:bold">🔥 모닥불</span>
        <button id="cf-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div style="font-size:10px;color:#ccc;margin-bottom:8px">
        연료: ${bar} ${fuelMin}:${String(fuelSecR).padStart(2,'0')}
        ${cf.lit ? '<span style="color:#ff9933">🔥 점화</span>' : '<span style="color:#888">💨 꺼짐</span>'}
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button id="cf-fuel-1" style="flex:1;padding:4px;background:#5a3010;color:#eee;border:1px solid #c86400;border-radius:3px;cursor:pointer">🪵 ×1 투입</button>
        <button id="cf-fuel-5" style="flex:1;padding:4px;background:#5a3010;color:#eee;border:1px solid #c86400;border-radius:3px;cursor:pointer">🪵 ×5 투입</button>
        ${!cf.lit ? `<button id="cf-relight" style="flex:1;padding:4px;background:#3a1500;color:#ff9933;border:1px solid #c86400;border-radius:3px;cursor:pointer">🔥 재점화</button>` : ''}
      </div>
      <div style="font-weight:bold;margin-bottom:6px;color:#ffcc88">🍖 간이 요리</div>
      <div id="cf-recipes"></div>
    `;
    document.body.appendChild(panel);

    const recipesDiv = panel.querySelector('#cf-recipes')!;
    for (const recipe of CAMPFIRE_RECIPES) {
      const hasIngredient = this.inventory.has(recipe.inputItem);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:3px;background:rgba(255,255,255,0.05);border-radius:3px';
      row.innerHTML = `
        <span>${recipe.icon} ${recipe.name} (${recipe.cookTimeSec}초)</span>
        <button style="padding:3px 8px;background:${hasIngredient && cf.lit ? '#c86400' : '#444'};color:#fff;border:none;border-radius:3px;cursor:${hasIngredient && cf.lit ? 'pointer' : 'default'};font-size:10px" ${!hasIngredient || !cf.lit ? 'disabled' : ''}>
          ${!hasIngredient ? '재료 없음' : !cf.lit ? '꺼짐' : '요리'}
        </button>
      `;
      row.querySelector('button')?.addEventListener('click', () => {
        if (!hasIngredient || !cf.lit) return;
        this.onCook(recipe, cf.id);
        this.close();
      });
      recipesDiv.appendChild(row);
    }

    panel.querySelector('#cf-close')?.addEventListener('click', () => this.close());

    panel.querySelector('#cf-fuel-1')?.addEventListener('click', () => {
      const ok = this.campfireSystem.addFuel(cf.id, 1, this.inventory);
      if (!ok) this.onNotify('목재가 없습니다', '#ffaa44');
      this.render();
    });
    panel.querySelector('#cf-fuel-5')?.addEventListener('click', () => {
      const count = Math.min(5, this.inventory.get('item_wood'));
      if (count === 0) { this.onNotify('목재가 없습니다', '#ffaa44'); return; }
      this.campfireSystem.addFuel(cf.id, count, this.inventory);
      this.render();
    });
    panel.querySelector('#cf-relight')?.addEventListener('click', () => {
      const ok = this.campfireSystem.relight(cf.id, this.inventory);
      if (!ok) this.onNotify('목재가 없습니다 (재점화: ×1 필요)', '#ffaa44');
      this.render();
    });
  }
}

function barPct(v: number): number { return Math.max(0, Math.min(1, v)); }
