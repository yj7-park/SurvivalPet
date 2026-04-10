import Phaser from 'phaser';
import { Inventory } from './Inventory';
import { SurvivalStats } from './SurvivalStats';
import { CombatSystem } from './CombatSystem';
import { WEAPONS, calcDamage, calcCooldownMs } from '../config/weapons';
import { CharacterStats } from '../entities/CharacterStats';
import { EquipmentSystem } from './EquipmentSystem';
import { ARMOR_DEFS, SHIELD_DEFS } from '../config/equipment';
import { RECIPE_ITEMS, RECIPE_ITEM_IDS } from '../config/recipeItems';
import { getItemRarity, RARITY_BORDER_CSS } from '../config/items';
import { ProficiencySystem, PROF_NAMES } from './ProficiencySystem';
import { HungerSystem } from './HungerSystem';
import { FOOD_DEFS } from '../config/foods';
import { SEED_ITEM_IDS } from '../config/crops';

const STACK_LIMITS: Record<string, number> = {
  item_wood: 99,
  item_stone: 99,
  item_processed_stone: 99,
  item_fish: 20,
  item_cooked_fish: 20,
  item_raw_meat: 20,
  item_cooked_meat: 20,
  item_hide: 30,
  item_tiger_fang: 10,
  item_bow: 1,
  item_sword_wood: 1,
  item_sword_stone: 1,
  item_fishing_rod: 1,
  item_torch: 10,
  item_armor_hide: 1,
  item_armor_wood: 1,
  item_armor_stone: 1,
  item_armor_iron: 1,
  item_shield_wood: 1,
  item_shield_stone: 1,
  item_sword_iron: 1,
  item_fish_stew: 10,
  item_meat_stew: 10,
  item_recipe_fish_stew: 1,
  item_recipe_meat_stew: 1,
  item_blueprint_iron_sword: 1,
  item_blueprint_armor: 1,
  // Farming tools
  item_hoe: 1,
  item_watering_can: 1,
  // Seeds
  item_seed_wheat: 20,
  item_seed_potato: 20,
  item_seed_carrot: 20,
  item_seed_pumpkin: 20,
  // Crops
  item_wheat: 99,
  item_potato: 99,
  item_carrot: 99,
  item_pumpkin: 99,
  // Cooked crops
  item_bread: 20,
  item_potato_soup: 10,
  item_carrot_stew: 10,
  item_pumpkin_porridge: 20,
  item_baked_potato: 20,
};
const DEFAULT_STACK = 99;

const ITEM_NAMES: Record<string, string> = {
  item_wood:            '목재',
  item_stone:           '석재',
  item_processed_stone: '가공석',
  item_fish:            '물고기',
  item_cooked_fish:     '구운 생선',
  item_raw_meat:        '날고기',
  item_cooked_meat:     '구운 고기',
  item_hide:            '가죽',
  item_tiger_fang:      '호랑이 이빨',
  item_bow:             '활',
  item_sword_wood:      '나무칼',
  item_sword_stone:     '석재칼',
  item_fishing_rod:     '낚싯대',
  item_torch:           '횃불',
  item_armor_hide:      '가죽 갑옷',
  item_armor_wood:      '목재 갑옷',
  item_armor_stone:     '석재 갑옷',
  item_armor_iron:      '철제 갑옷',
  item_shield_wood:     '목재 방패',
  item_shield_stone:    '석재 방패',
  item_sword_iron:      '철제 칼',
  item_fish_stew:       '생선 스튜',
  item_meat_stew:       '고기 스튜',
  item_recipe_fish_stew:     '생선 스튜 레시피',
  item_recipe_meat_stew:     '고기 스튜 레시피',
  item_blueprint_iron_sword: '철제칼 도면',
  item_blueprint_armor:      '갑옷 도면',
  // Farming tools
  item_hoe:          '괭이',
  item_watering_can: '물뿌리개',
  // Seeds
  item_seed_wheat:   '밀 씨앗',
  item_seed_potato:  '감자 씨앗',
  item_seed_carrot:  '당근 씨앗',
  item_seed_pumpkin: '호박 씨앗',
  // Crops
  item_wheat:   '밀',
  item_potato:  '감자',
  item_carrot:  '당근',
  item_pumpkin: '호박',
  // Cooked crops
  item_bread:             '밀빵',
  item_potato_soup:       '감자 스프',
  item_carrot_stew:       '당근 스튜',
  item_pumpkin_porridge:  '호박죽',
  item_baked_potato:      '구운 감자',
};

const WEAPON_ITEM_IDS = new Set(['item_bow', 'item_sword_wood', 'item_sword_stone', 'item_sword_iron']);
const FOOD_ITEM_IDS   = new Set(Object.keys(FOOD_DEFS));
const TOOL_ITEM_IDS   = new Set(['item_hoe', 'item_watering_can']);
const ARMOR_ITEM_IDS  = new Set(Object.keys(ARMOR_DEFS));
const SHIELD_ITEM_IDS = new Set(Object.keys(SHIELD_DEFS));

export class InventoryUI {
  private panel: HTMLDivElement | null = null;
  private equippedWeaponId: string | null = null;

  // Phaser HUD (weapon slot, bottom-right)
  private hudWeaponLabel: Phaser.GameObjects.Text;
  private hudWeaponName: Phaser.GameObjects.Text;

  private equipmentSystem: EquipmentSystem | null = null;
  private proficiencySystem: ProficiencySystem | null = null;

  private hungerSystem: HungerSystem | null = null;
  private onOpenCallback?: () => void;
  private onEatCallback?: () => void;
  private onEatFeedbackCb?: (hungerRecovered: number, hpChanged: number, poisoned: boolean) => void;
  private onToolUseCb?: (itemId: string) => void;
  private onEquipCallback?: () => void;

  setOnOpen(cb: () => void): void { this.onOpenCallback = cb; }
  setOnEat(cb: () => void): void { this.onEatCallback = cb; }
  setOnEatFeedback(cb: (hungerRecovered: number, hpChanged: number, poisoned: boolean) => void): void { this.onEatFeedbackCb = cb; }
  setOnToolUse(cb: (itemId: string) => void): void { this.onToolUseCb = cb; }
  setOnEquip(cb: () => void): void { this.onEquipCallback = cb; }

  constructor(
    private scene: Phaser.Scene,
    private inventory: Inventory,
    private survival: SurvivalStats,
    private combat: CombatSystem,
    private charStats: CharacterStats,
    private getNearTable: (() => boolean) | null = null,
    equipmentSystem: EquipmentSystem | null = null,
    proficiencySystem: ProficiencySystem | null = null,
    hungerSystem: HungerSystem | null = null,
  ) {
    this.equipmentSystem = equipmentSystem;
    this.proficiencySystem = proficiencySystem;
    this.hungerSystem = hungerSystem;
    const W = scene.scale.width;
    const H = scene.scale.height;

    // Initial positions at (0,0); GameScene.repositionHUD() will set correct positions
    this.hudWeaponLabel = scene.add.text(0, 0, '무기', {
      fontSize: '9px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);

    this.hudWeaponName = scene.add.text(0, 0, '맨손', {
      fontSize: '11px',
      color: '#ffe8a0',
      fontFamily: 'monospace',
      backgroundColor: '#00000099',
      padding: { x: 5, y: 2 },
    }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  toggle(): void {
    if (this.panel) {
      this.close();
    } else {
      this.open();
    }
  }

  close(): void {
    this.panel?.remove();
    this.panel = null;
  }

  update(): void {
    if (this.panel) this.refreshPanel();
    this.updateWeaponHUD();
  }

  getEquippedWeaponId(): string | null {
    return this.equippedWeaponId;
  }

  equipWeapon(id: string | null): void {
    this.equippedWeaponId = id;
    this.combat.equipWeapon(id);
    // Auto-unequip shield if two-handed weapon equipped
    if (this.equipmentSystem) {
      this.equipmentSystem.handleWeaponEquip(id, this.inventory);
    }
    this.updateWeaponHUD();
    if (this.panel) this.refreshPanel();
    if (id) this.onEquipCallback?.();
  }

  destroy(): void {
    this.close();
    this.hudWeaponLabel.destroy();
    this.hudWeaponName.destroy();
  }

  // ── Panel ─────────────────────────────────────────────────────────────────────

  private open(): void {
    this.onOpenCallback?.();
    const panel = document.createElement('div');
    panel.id = 'inventory-panel';
    panel.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      width: 320px; background: rgba(10,15,25,0.93);
      border: 1px solid #446; border-radius: 6px; padding: 10px; z-index: 200;
      color: #eee; font: 12px monospace; user-select: none;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:bold;color:#e2b96f">가방 [V]</span>
        <button id="inv-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="inv-slots" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px"></div>
      <div id="inv-tooltip" style="font-size:10px;color:#aaa;min-height:18px;text-align:center"></div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    panel.querySelector('#inv-close')!.addEventListener('click', () => this.close());
    this.refreshPanel();
  }

  private refreshPanel(): void {
    if (!this.panel) return;
    const container = this.panel.querySelector('#inv-slots') as HTMLDivElement;
    const tooltip   = this.panel.querySelector('#inv-tooltip') as HTMLDivElement;
    container.innerHTML = '';

    // Collect all items; show at least 10 slots
    const items = this.inventory.getAll();
    const SLOT_COUNT = Math.max(10, items.length + 2);

    const slotMap = new Map<string, number>();
    for (const { key, count } of items) slotMap.set(key, count);

    const keys = Array.from(slotMap.keys());

    for (let i = 0; i < SLOT_COUNT; i++) {
      const key   = keys[i] ?? null;
      const count = key ? (slotMap.get(key) ?? 0) : 0;
      const slot  = document.createElement('div');

      const isEquipped  = key && WEAPON_ITEM_IDS.has(key) && this.equippedWeaponId === this.weaponIdFromItem(key);
      const isWeapon    = key && WEAPON_ITEM_IDS.has(key);
      const isFood      = key && FOOD_ITEM_IDS.has(key);
      const isArmor     = key && ARMOR_ITEM_IDS.has(key);
      const isShield    = key && SHIELD_ITEM_IDS.has(key);
      const isRecipeItem = key && RECIPE_ITEM_IDS.has(key);

      const rarity = key ? getItemRarity(key) : 'common';
      const rarityBorder = isEquipped ? '#88cc44' : (rarity !== 'common' ? RARITY_BORDER_CSS[rarity] : '#334');
      slot.style.cssText = `
        width:56px; height:56px; background:${isEquipped ? '#2a4020' : '#1a2030'};
        border:${rarity !== 'common' ? '2px' : '1px'} solid ${rarityBorder};
        border-radius:4px; display:flex; flex-direction:column;
        align-items:center; justify-content:center; cursor:${key ? 'pointer' : 'default'};
        position:relative; font-size:9px; text-align:center; padding:2px; box-sizing:border-box;
      `;

      if (key) {
        const icon = document.createElement('div');
        icon.style.cssText = 'font-size:18px;line-height:1;margin-bottom:2px;';
        icon.textContent = this.itemEmoji(key);
        slot.appendChild(icon);

        const label = document.createElement('div');
        label.style.cssText = `color:${isEquipped ? '#aaffaa' : '#ccc'};word-break:break-all;line-height:1.1;`;
        label.textContent = ITEM_NAMES[key] ?? key.replace('item_', '');
        slot.appendChild(label);

        const countDiv = document.createElement('div');
        countDiv.style.cssText = 'position:absolute;bottom:2px;right:4px;color:#888;font-size:9px;';
        countDiv.textContent = `${count}`;
        slot.appendChild(countDiv);

        // Stack limit warning
        const limit = STACK_LIMITS[key] ?? DEFAULT_STACK;
        if (count >= limit) {
          countDiv.style.color = '#ff8844';
        }

        const isTool = TOOL_ITEM_IDS.has(key);
        const isSeed = SEED_ITEM_IDS.has(key);

        slot.addEventListener('mouseenter', () => {
          if (isWeapon) {
            tooltip.textContent = isEquipped ? '클릭: 장착 해제' : '클릭: 장착';
          } else if (isTool || isSeed) {
            tooltip.textContent = '클릭: 사용하기';
          } else if (isArmor || isShield) {
            tooltip.textContent = '우클릭: 장착';
          } else if (isRecipeItem) {
            const def = RECIPE_ITEMS[key];
            const alreadyKnown = this.proficiencySystem?.isUnlockedByResearch(def.unlocksId);
            tooltip.textContent = alreadyKnown ? '이미 학습한 레시피' : `클릭: [${def.label}] 학습`;
          } else if (isFood) {
            const foodDef = FOOD_DEFS[key];
            if (foodDef) {
              const nearTable = this.getNearTable?.() ?? false;
              const restore = foodDef.hungerRecovery;
              const bonus = nearTable ? ` → ${Math.ceil(restore * 1.3)} (식탁+30%)` : '';
              const hpStr = foodDef.hpChange > 0 ? ` / HP+${foodDef.hpChange}` :
                            foodDef.hpChange < 0 ? ` / HP${foodDef.hpChange}` : '';
              const poisonWarn = foodDef.poisonChance > 0 ? ` ⚠ 식중독 ${Math.round(foodDef.poisonChance * 100)}%` : '';
              tooltip.textContent = `클릭: 먹기 (+${restore} 포만감${bonus}${hpStr}${poisonWarn})`;
            } else {
              tooltip.textContent = '먹을 수 없습니다';
            }
          } else {
            tooltip.textContent = ITEM_NAMES[key] ?? key;
          }
        });
        slot.addEventListener('mouseleave', () => { tooltip.textContent = ''; });

        slot.addEventListener('click', () => {
          if (isWeapon) {
            this.handleWeaponClick(key);
          } else if (isTool || isSeed) {
            this.onToolUseCb?.(key);
            this.close();
          } else if (isFood) {
            this.handleFoodClick(key, tooltip);
          } else if (isRecipeItem) {
            this.handleRecipeItemClick(key, tooltip);
          }
        });

        if ((isArmor || isShield) && this.equipmentSystem) {
          slot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleEquipmentRightClick(key, isShield ? 'shield' : 'armor', tooltip);
          });
        }
      }

      container.appendChild(slot);
    }
  }

  private handleWeaponClick(itemKey: string): void {
    const weapId = this.weaponIdFromItem(itemKey);
    if (!weapId) return;
    if (this.equippedWeaponId === weapId) {
      this.equipWeapon(null);
    } else {
      this.equipWeapon(weapId);
    }
  }

  private handleRecipeItemClick(itemKey: string, tooltip: HTMLDivElement): void {
    const def = RECIPE_ITEMS[itemKey];
    if (!def) return;

    if (this.proficiencySystem?.isUnlockedByResearch(def.unlocksId)) {
      tooltip.textContent = '이미 알고 있는 레시피입니다';
      return;
    }

    const confirmed = window.confirm(`[${def.label}]을(를) 학습하시겠습니까?`);
    if (!confirmed) return;

    if (def.requiredProficiency && this.proficiencySystem) {
      const currentLevel = this.proficiencySystem.getLevel(def.requiredProficiency.type);
      if (currentLevel < def.requiredProficiency.level) {
        const typeName = PROF_NAMES[def.requiredProficiency.type];
        window.alert(`${typeName} 숙련도 Lv.${def.requiredProficiency.level} 이상이 필요합니다 (현재 Lv.${currentLevel})`);
        return;
      }
    }

    this.proficiencySystem?.unlockByItem(def.unlocksId);
    tooltip.textContent = '';
    this.showNotice(`✅ [${def.label}]을(를) 습득했습니다!`);
  }

  private showNotice(msg: string): void {
    const existing = document.getElementById('recipe-learn-notice');
    existing?.remove();
    const notice = document.createElement('div');
    notice.id = 'recipe-learn-notice';
    notice.style.cssText = `
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
      color:#ffd700; font:12px monospace; background:rgba(0,0,0,0.7);
      padding:5px 12px; border-radius:4px; z-index:500; pointer-events:none; opacity:1;
      transition: opacity 1.5s ease;
    `;
    notice.textContent = msg;
    document.body.appendChild(notice);
    setTimeout(() => { notice.style.opacity = '0'; setTimeout(() => notice.remove(), 1500); }, 500);
  }

  private handleEquipmentRightClick(
    itemKey: string,
    slot: 'armor' | 'shield',
    tooltip: HTMLDivElement,
  ): void {
    if (!this.equipmentSystem) return;
    const result = this.equipmentSystem.equip(slot, itemKey, this.inventory, this.equippedWeaponId);
    if (result.ok) {
      tooltip.textContent = '장착 완료';
      if (this.panel) this.refreshPanel();
    } else {
      tooltip.textContent = result.reason;
    }
  }

  private handleFoodClick(itemKey: string, tooltip: HTMLDivElement): void {
    const foodDef = FOOD_DEFS[itemKey];
    if (!foodDef) {
      tooltip.textContent = '먹을 수 없습니다';
      return;
    }
    if (!this.inventory.has(itemKey, 1)) return;

    const nearTable = this.getNearTable?.() ?? false;
    this.inventory.remove(itemKey, 1);

    if (this.hungerSystem) {
      const result = this.hungerSystem.eat(foodDef, this.survival, this.charStats, nearTable);
      this.onEatCallback?.();
      this.onEatFeedbackCb?.(result.hungerRecovered, result.hpChanged, result.poisoned);
      if (result.diningBonus) this.showTableBonusPopup();
      if (result.poisoned) this.showNotice('🤢 식중독에 걸렸습니다!');
    } else {
      // Fallback if no hungerSystem
      const restore = nearTable ? Math.ceil(foodDef.hungerRecovery * 1.3) : foodDef.hungerRecovery;
      this.survival.eat(restore);
      if (foodDef.hpChange > 0) {
        this.survival.hp = Math.min(this.survival.maxHp, this.survival.hp + foodDef.hpChange);
      }
      if (nearTable) this.showTableBonusPopup();
    }

    if (this.panel) this.refreshPanel();
  }

  private showTableBonusPopup(): void {
    const existing = document.getElementById('table-bonus-popup');
    existing?.remove();

    const popup = document.createElement('div');
    popup.id = 'table-bonus-popup';
    popup.style.cssText = `
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      color: #ffd700; font: 12px monospace; text-align: center;
      background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 4px;
      z-index: 500; pointer-events: none; opacity: 1;
      transition: opacity 1.5s ease;
    `;
    popup.textContent = '🍽 식탁에서 먹었습니다 (+30%)';
    document.body.appendChild(popup);

    // Fade out after 0.1s delay then 1.4s fade
    setTimeout(() => {
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 1500);
    }, 100);
  }

  private weaponIdFromItem(itemKey: string): string | null {
    // item_bow -> bow, item_sword_wood -> sword_wood
    const id = itemKey.replace('item_', '');
    return WEAPONS.find(w => w.id === id) ? id : null;
  }

  private itemEmoji(key: string): string {
    const map: Record<string, string> = {
      item_wood:            '🪵',
      item_stone:           '🪨',
      item_processed_stone: '🧱',
      item_fish:            '🐟',
      item_cooked_fish:     '🍴',
      item_raw_meat:        '🥩',
      item_cooked_meat:     '🍖',
      item_hide:            '🦺',
      item_tiger_fang:      '🦷',
      item_bow:             '🏹',
      item_sword_wood:      '🗡',
      item_sword_stone:     '⚔',
      item_fishing_rod:     '🎣',
      item_torch:           '🔥',
      item_armor_hide:           '🦺',
      item_armor_wood:           '🪵',
      item_armor_stone:          '🧱',
      item_armor_iron:           '⚙',
      item_shield_wood:          '🛡',
      item_shield_stone:         '🛡',
      item_sword_iron:           '⚔',
      item_fish_stew:            '🍲',
      item_meat_stew:            '🍲',
      item_recipe_fish_stew:     '📜',
      item_recipe_meat_stew:     '📜',
      item_blueprint_iron_sword: '📋',
      item_blueprint_armor:      '📋',
      // Farming
      item_hoe:          '⛏',
      item_watering_can: '🪣',
      item_seed_wheat:   '🌾',
      item_seed_potato:  '🥔',
      item_seed_carrot:  '🥕',
      item_seed_pumpkin: '🎃',
      item_wheat:        '🌾',
      item_potato:       '🥔',
      item_carrot:       '🥕',
      item_pumpkin:      '🎃',
      item_bread:             '🍞',
      item_potato_soup:       '🥣',
      item_carrot_stew:       '🥘',
      item_pumpkin_porridge:  '🥣',
      item_baked_potato:      '🥔',
    };
    return map[key] ?? '📦';
  }

  // ── Weapon HUD ────────────────────────────────────────────────────────────────

  private updateWeaponHUD(): void {
    if (this.equippedWeaponId) {
      const w = WEAPONS.find(wp => wp.id === this.equippedWeaponId);
      if (w) {
        const dmg = calcDamage(w, this.charStats.str);
        const cooldownMs = calcCooldownMs(w, this.charStats.agi);
        const cooldownSec = (cooldownMs / 1000).toFixed(1);
        const text = `${w.name}\nDMG ${dmg} SPD ${cooldownSec}s`;
        this.hudWeaponName.setText(text);
      } else {
        this.hudWeaponName.setText(this.equippedWeaponId);
      }
      this.hudWeaponName.setStyle({ color: '#aaffaa' });
    } else {
      const dmg = calcDamage(null, this.charStats.str);
      const cooldownMs = calcCooldownMs(null, this.charStats.agi);
      const cooldownSec = (cooldownMs / 1000).toFixed(1);
      const text = `맨손\nDMG ${dmg} SPD ${cooldownSec}s`;
      this.hudWeaponName.setText(text);
      this.hudWeaponName.setStyle({ color: '#ffe8a0' });
    }
  }
}
