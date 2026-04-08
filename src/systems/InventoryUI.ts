import Phaser from 'phaser';
import { Inventory } from './Inventory';
import { SurvivalStats } from './SurvivalStats';
import { CombatSystem } from './CombatSystem';
import { WEAPONS, calcDamage, calcCooldownMs } from '../config/weapons';
import { CharacterStats } from '../entities/CharacterStats';

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
};

const WEAPON_ITEM_IDS = new Set(['item_bow', 'item_sword_wood', 'item_sword_stone']);
const FOOD_ITEM_IDS   = new Set(['item_cooked_meat', 'item_cooked_fish', 'item_raw_meat', 'item_fish']);

const FOOD_RESTORE: Record<string, number> = {
  item_cooked_meat: 45,
  item_cooked_fish: 35,
};

export class InventoryUI {
  private panel: HTMLDivElement | null = null;
  private equippedWeaponId: string | null = null;

  // Phaser HUD (weapon slot, bottom-right)
  private hudWeaponLabel: Phaser.GameObjects.Text;
  private hudWeaponName: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private inventory: Inventory,
    private survival: SurvivalStats,
    private combat: CombatSystem,
    private charStats: CharacterStats,
  ) {
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
    this.updateWeaponHUD();
    if (this.panel) this.refreshPanel();
  }

  destroy(): void {
    this.close();
    this.hudWeaponLabel.destroy();
    this.hudWeaponName.destroy();
  }

  // ── Panel ─────────────────────────────────────────────────────────────────────

  private open(): void {
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

      slot.style.cssText = `
        width:56px; height:56px; background:${isEquipped ? '#2a4020' : '#1a2030'};
        border:1px solid ${isEquipped ? '#88cc44' : '#334'};
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

        slot.addEventListener('mouseenter', () => {
          if (isWeapon) {
            tooltip.textContent = isEquipped ? '클릭: 장착 해제' : '클릭: 장착';
          } else if (isFood) {
            if (FOOD_RESTORE[key]) {
              tooltip.textContent = `클릭: 먹기 (+${FOOD_RESTORE[key]} 포만감)`;
            } else {
              tooltip.textContent = '먼저 조리하세요';
            }
          } else {
            tooltip.textContent = ITEM_NAMES[key] ?? key;
          }
        });
        slot.addEventListener('mouseleave', () => { tooltip.textContent = ''; });

        slot.addEventListener('click', () => {
          if (isWeapon) {
            this.handleWeaponClick(key);
          } else if (isFood) {
            this.handleFoodClick(key, tooltip);
          }
        });
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

  private handleFoodClick(itemKey: string, tooltip: HTMLDivElement): void {
    const restore = FOOD_RESTORE[itemKey];
    if (!restore) {
      tooltip.textContent = '먼저 조리하세요';
      return;
    }
    if (!this.inventory.has(itemKey, 1)) return;
    this.inventory.remove(itemKey, 1);
    this.survival.eat(restore);
    if (this.panel) this.refreshPanel();
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
