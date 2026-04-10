import { ProficiencyType } from './ProficiencySystem';

export const SAVE_VERSION = 1;

export interface InventorySaveData {
  slots: Array<{ itemId: string; amount: number } | null>;
}

export interface CharacterSaveData {
  name: string;
  appearance: number;
  mapX: number;
  mapY: number;
  x: number;
  y: number;
  stats: { str: number; agi: number; con: number; int: number };
  hp: number;
  hunger: number;
  fatigue: number;
  action: number;
  maxHpDebuff: number;
  poisoning: { active: boolean; timeLeft: number };
  inventory: InventorySaveData;
  equipment: {
    weapon: string | null;
    armor: string | null;
    shield: string | null;
    torch?: string | null;
    torchRemainingMs?: number;
  };
  proficiency: Record<ProficiencyType, { level: number; xp: number; totalXp: number }>;
  unlockedResearch: string[];
  knownRecipes: string[];
}

export interface BuildingSaveEntry {
  type: string;
  tileX: number;
  tileY: number;
  durability: number;
  material: 'wood' | 'stone';
  doorOpen?: boolean;
  placedAt?: number;   // for placed torches
  durationMs?: number; // for placed torches
}

export interface CampfireSaveEntry {
  id: string;
  tileX: number;
  tileY: number;
  mapX: number;
  mapY: number;
  fuelMs: number;
  lit: boolean;
  isIndoor: boolean;
}

export interface FarmlandSaveEntry {
  tileX: number;
  tileY: number;
  mapX: number;
  mapY: number;
  isWet: boolean;
  wetUntil: number;
  crop?: { type: string; stage: 0 | 1 | 2; growthProgress: number };
}

export interface WorldSaveData {
  buildings: BuildingSaveEntry[];
  campfires?: CampfireSaveEntry[];
  farmlands?: FarmlandSaveEntry[];
  harvestedWildCrops?: string[];
  toolState?: { hoeDurability: number; wateringCanDurability: number; wateringCanCharges: number };
  clearedTrees: Array<{ tileX: number; tileY: number; regrowAt?: number }>;
  clearedRocks: Array<{ tileX: number; tileY: number }>;
  gameTime: {
    day: number;
    timeOfDay: number;
    realElapsedMs: number;
  };
  visitedMaps: Array<[number, number]>;
  killedEnemies: string[];
}

export interface SettingsSaveData {
  autoPickup: boolean;
  autoSaveInterval: number;
  showFPS: boolean;
  showCoords: boolean;
  language: string;
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  screenShake: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  playtime: number;
  seed: string;
  character: CharacterSaveData;
  world: WorldSaveData;
  settings: SettingsSaveData;
}

export interface SlotMeta {
  slot: number;
  occupied: boolean;
  savedAt: number;
  playtime: number;
  seed: string;
  day: number;
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

export class SaveSystem {
  private lastUsedSlot = 0;
  private readonly SLOT_KEYS = ['sv_slot_0', 'sv_slot_1', 'sv_slot_2'] as const;
  private readonly META_PREFIX = 'sv_meta_';

  save(slot: number, data: SaveData): SaveResult {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(this.SLOT_KEYS[slot], json);
      this.lastUsedSlot = slot;
      this.updateMeta(slot, data);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }

  saveAuto(data: SaveData): SaveResult {
    return this.save(this.lastUsedSlot, data);
  }

  load(slot: number): SaveData | null {
    try {
      const json = localStorage.getItem(this.SLOT_KEYS[slot]);
      if (!json) return null;
      return this.migrate(JSON.parse(json));
    } catch {
      return null;
    }
  }

  hasSave(slot: number): boolean {
    return localStorage.getItem(this.SLOT_KEYS[slot]) !== null;
  }

  getSlotMeta(): SlotMeta[] {
    return [0, 1, 2].map(i => {
      const raw = localStorage.getItem(this.META_PREFIX + i);
      if (raw) {
        try { return JSON.parse(raw) as SlotMeta; } catch { /* fall through */ }
      }
      return { slot: i, occupied: false, savedAt: 0, playtime: 0, seed: '', day: 0 };
    });
  }

  deleteSave(slot: number): void {
    localStorage.removeItem(this.SLOT_KEYS[slot]);
    localStorage.removeItem(this.META_PREFIX + slot);
  }

  setLastUsedSlot(slot: number): void { this.lastUsedSlot = slot; }
  getLastUsedSlot(): number { return this.lastUsedSlot; }

  saveSettings(settings: SettingsSaveData): void {
    localStorage.setItem('sv_settings', JSON.stringify(settings));
  }

  loadSettings(): SettingsSaveData {
    const defaults: SettingsSaveData = {
      autoPickup: false,
      autoSaveInterval: 5,
      showFPS: false,
      showCoords: false,
      language: 'ko',
      masterVolume: 0.7,
      sfxVolume: 0.8,
      bgmVolume: 0.4,
      screenShake: 1.0,
    };
    try {
      const raw = localStorage.getItem('sv_settings');
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }

  private updateMeta(slot: number, data: SaveData): void {
    const meta: SlotMeta = {
      slot,
      occupied: true,
      savedAt: data.savedAt,
      playtime: data.playtime,
      seed: data.seed,
      day: data.world.gameTime.day,
    };
    localStorage.setItem(this.META_PREFIX + slot, JSON.stringify(meta));
  }

  migrate(raw: unknown): SaveData {
    const data = raw as { version?: number; character?: Record<string, unknown> };
    if (!data.version || data.version < 1) {
      if (data.character && !data.character['proficiency']) {
        data.character['proficiency'] = {};
      }
      (data as { version: number }).version = 1;
    }
    // Migrate: add name/appearance if missing
    if (data.character && data.character['name'] === undefined) {
      data.character['name'] = '생존자';
    }
    if (data.character && data.character['appearance'] === undefined) {
      data.character['appearance'] = 0;
    }
    // Migrate: add hunger system fields if missing
    if (data.character && data.character['maxHpDebuff'] === undefined) {
      data.character['maxHpDebuff'] = 0;
    }
    if (data.character && data.character['poisoning'] === undefined) {
      data.character['poisoning'] = { active: false, timeLeft: 0 };
    }
    // Migrate: add visitedMaps/killedEnemies if missing
    const world = (data as Record<string, unknown>)['world'] as Record<string, unknown> | undefined;
    if (world) {
      if (!Array.isArray(world['visitedMaps'])) world['visitedMaps'] = [];
      if (!Array.isArray(world['killedEnemies'])) world['killedEnemies'] = [];
    }
    return data as unknown as SaveData;
  }
}
