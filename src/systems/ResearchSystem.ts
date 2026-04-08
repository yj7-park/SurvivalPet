import { ProficiencyType } from './ProficiencySystem';
import { Inventory } from './Inventory';

export interface ResearchDef {
  id: string;
  label: string;
  inputs: { itemId: string; amount: number }[];
  timeMs: number;
  requiredProficiency?: { type: ProficiencyType; level: number };
  unlocks: string; // recipe/research ID to unlock
}

export const RESEARCH_DEFS: ResearchDef[] = [
  {
    id: 'research_stone_wall',
    label: '🔬 석재 벽 연구',
    inputs: [{ itemId: 'item_processed_stone', amount: 5 }],
    timeMs: 30_000,
    requiredProficiency: { type: 'building', level: 2 },
    unlocks: 'research_stone_wall',
  },
  {
    id: 'research_stone_floor',
    label: '🔬 석재 바닥 연구',
    inputs: [{ itemId: 'item_processed_stone', amount: 3 }],
    timeMs: 20_000,
    requiredProficiency: { type: 'building', level: 2 },
    unlocks: 'research_stone_floor',
  },
  {
    id: 'research_stone_bed',
    label: '🔬 석재 침대 연구',
    inputs: [
      { itemId: 'item_processed_stone', amount: 6 },
      { itemId: 'item_wood', amount: 3 },
    ],
    timeMs: 40_000,
    requiredProficiency: { type: 'building', level: 3 },
    unlocks: 'research_stone_bed',
  },
  {
    id: 'research_advanced_weapon',
    label: '🔬 고급 무기술',
    inputs: [{ itemId: 'item_processed_stone', amount: 10 }],
    timeMs: 60_000,
    requiredProficiency: { type: 'crafting', level: 4 },
    unlocks: 'research_advanced_weapon',
  },
];

export class ResearchSystem {
  private current: { def: ResearchDef; startedAt: number; workbenchX: number; workbenchY: number } | null = null;
  private completed = new Set<string>();
  private elapsed = 0;

  startResearch(def: ResearchDef, inventory: Inventory, workbenchX: number, workbenchY: number): boolean {
    if (this.current) return false;
    if (this.completed.has(def.id)) return false;

    for (const i of def.inputs) {
      if (!inventory.has(i.itemId, i.amount)) return false;
    }
    for (const i of def.inputs) {
      inventory.remove(i.itemId, i.amount);
    }

    this.current = { def, startedAt: Date.now(), workbenchX, workbenchY };
    this.elapsed = 0;
    return true;
  }

  update(delta: number): ResearchDef | null {
    if (!this.current) return null;
    this.elapsed += delta;
    if (this.elapsed >= this.current.def.timeMs) {
      const def = this.current.def;
      this.completed.add(def.id);
      this.current = null;
      this.elapsed = 0;
      return def;
    }
    return null;
  }

  cancelResearch(): void {
    this.current = null;
    this.elapsed = 0;
  }

  isCompleted(id: string): boolean { return this.completed.has(id); }
  isInProgress(): boolean { return this.current !== null; }
  getCurrentDef(): ResearchDef | null { return this.current?.def ?? null; }
  getElapsed(): number { return this.elapsed; }
  getCurrentDuration(): number { return this.current?.def.timeMs ?? 1; }
  getWorkbenchPos(): { x: number; y: number } | null {
    return this.current ? { x: this.current.workbenchX, y: this.current.workbenchY } : null;
  }
}
