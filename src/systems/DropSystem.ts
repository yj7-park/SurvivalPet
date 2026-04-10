import Phaser from 'phaser';
import { DROP_TABLES } from '../config/dropTables';
import { RECIPE_ITEM_IDS } from '../config/recipeItems';
import { Inventory } from './Inventory';
import { SeededRandom } from '../utils/seedRandom';

export interface GroundItem {
  id: string;
  itemId: string;
  amount: number;
  x: number;
  y: number;
  droppedAt: number; // Date.now()
  glowing: boolean;
  ttlMs: number;     // 0 = immortal (recipe/blueprint)
}

export type PickupResult =
  | { ok: true;  item: GroundItem }
  | { ok: false; reason: 'inventory_full' | 'not_found' | 'too_far' };

// Despawn timers (ms)
const FOOD_ITEMS   = new Set(['item_fish', 'item_cooked_fish', 'item_raw_meat', 'item_cooked_meat',
                               'item_fish_stew', 'item_meat_stew']);
const EQUIP_ITEMS  = new Set(['item_armor_hide','item_armor_wood','item_armor_stone','item_armor_iron',
                               'item_shield_wood','item_shield_stone',
                               'item_sword_wood','item_sword_stone','item_sword_iron','item_bow']);

function ttlFor(itemId: string): number {
  if (RECIPE_ITEM_IDS.has(itemId)) return 0;  // immortal
  if (FOOD_ITEMS.has(itemId))  return 2 * 60 * 1000;
  if (EQUIP_ITEMS.has(itemId)) return 5 * 60 * 1000;
  return 3 * 60 * 1000; // resources
}

const BLINK_START_MS = 10_000;
const AUTO_PICKUP_TYPES = new Set([
  'item_wood','item_stone','item_fish','item_raw_meat','item_hide','item_processed_stone',
]);
const PICKUP_RANGE_PX = 48;

let _nextId = 0;

interface SpriteBundle {
  glow:  Phaser.GameObjects.Arc | null;
  image: Phaser.GameObjects.Image;
  text:  Phaser.GameObjects.Text;
  name:  Phaser.GameObjects.Text | null;
}

export class DropSystem {
  private groundItems  = new Map<string, GroundItem>();
  private spriteBundles = new Map<string, SpriteBundle>();
  private autoPickup = false;

  constructor(private scene: Phaser.Scene) {}

  setAutoPickup(v: boolean): void { this.autoPickup = v; }
  getAutoPickup(): boolean { return this.autoPickup; }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  spawnDrops(enemyType: string, x: number, y: number, rngSeed: string): void {
    const table = DROP_TABLES[enemyType];
    if (!table) return;

    const rng = new SeededRandom(rngSeed);

    const results: Array<{ itemId: string; amount: number }> = [];

    for (const entry of table.guaranteedDrops ?? []) {
      const amount = entry.amountMin + Math.floor(rng.next() * (entry.amountMax - entry.amountMin + 1));
      results.push({ itemId: entry.itemId, amount });
    }

    for (const entry of table.drops) {
      if (rng.next() < entry.chance) {
        const amount = entry.amountMin + Math.floor(rng.next() * (entry.amountMax - entry.amountMin + 1));
        results.push({ itemId: entry.itemId, amount });
      }
    }

    // Spread items around kill position (8px radius)
    for (const { itemId, amount } of results) {
      const angle  = rng.next() * Math.PI * 2;
      const radius = rng.next() * 8;
      const ix = x + Math.cos(angle) * radius;
      const iy = y + Math.sin(angle) * radius;
      this.createGroundItem(itemId, amount, ix, iy);
    }
  }

  private createGroundItem(itemId: string, amount: number, x: number, y: number): void {
    const id = `gi_${_nextId++}`;
    const isGlowing = RECIPE_ITEM_IDS.has(itemId);
    const item: GroundItem = {
      id, itemId, amount, x, y,
      droppedAt: Date.now(),
      glowing: isGlowing,
      ttlMs: ttlFor(itemId),
    };
    this.groundItems.set(id, item);
    this.createSprite(id, item);
  }

  // ── Sprites ───────────────────────────────────────────────────────────────

  private createSprite(id: string, item: GroundItem): void {
    let glow: Phaser.GameObjects.Arc | null = null;

    if (item.glowing) {
      const color = item.itemId.startsWith('item_recipe') ? 0xffd700 : 0x00bfff;
      glow = this.scene.add.arc(item.x, item.y, 12, 0, 360, false, color, 0.35)
        .setDepth(item.y + 0.3);
    }

    // Use registered texture if available, fallback to colored square
    const texKey = item.itemId;
    const hasTexture = this.scene.textures.exists(texKey);
    const image = hasTexture
      ? this.scene.add.image(item.x, item.y, texKey).setScale(0.5).setDepth(item.y + 0.5)
      : this.scene.add.image(item.x, item.y, '__DEFAULT').setTint(0x88ff88).setScale(0.5).setDepth(item.y + 0.5);

    const amountText = this.scene.add.text(
      item.x + 8, item.y + 6,
      item.amount > 1 ? `×${item.amount}` : '',
      { fontSize: '8px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2 },
    ).setDepth(item.y + 0.6).setOrigin(0, 0);

    let nameText: Phaser.GameObjects.Text | null = null;
    if (item.glowing) {
      nameText = this.scene.add.text(
        item.x, item.y - 16,
        item.itemId.replace('item_', '').replace(/_/g, ' '),
        { fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2 },
      ).setDepth(item.y + 0.7).setOrigin(0.5, 1);
    }

    this.spriteBundles.set(id, { glow, image, text: amountText, name: nameText });
  }

  private destroySprite(id: string): void {
    const bundle = this.spriteBundles.get(id);
    if (!bundle) return;
    bundle.glow?.destroy();
    bundle.image.destroy();
    bundle.text.destroy();
    bundle.name?.destroy();
    this.spriteBundles.delete(id);
  }

  // ── Pickup ────────────────────────────────────────────────────────────────

  getItemsNear(x: number, y: number, radius: number): GroundItem[] {
    const result: GroundItem[] = [];
    for (const item of this.groundItems.values()) {
      if (Math.hypot(item.x - x, item.y - y) <= radius) result.push(item);
    }
    return result;
  }

  /** Returns closest ground item within click radius, or null */
  getItemAtClick(wx: number, wy: number): GroundItem | null {
    let closest: GroundItem | null = null;
    let best = 20; // click tolerance px
    for (const item of this.groundItems.values()) {
      const d = Math.hypot(item.x - wx, item.y - wy);
      if (d < best) { best = d; closest = item; }
    }
    return closest;
  }

  pickup(itemId: string, inventory: Inventory, playerX: number, playerY: number): PickupResult {
    const item = this.groundItems.get(itemId);
    if (!item) return { ok: false, reason: 'not_found' };
    if (Math.hypot(item.x - playerX, item.y - playerY) > PICKUP_RANGE_PX) {
      return { ok: false, reason: 'too_far' };
    }
    if (!inventory.canAdd(item.itemId)) {
      return { ok: false, reason: 'inventory_full' };
    }
    inventory.add(item.itemId, item.amount);
    this.groundItems.delete(itemId);
    this.destroySprite(itemId);
    return { ok: true, item };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(delta: number, playerX: number, playerY: number, inventory: Inventory): void {
    const now  = Date.now();
    const time = now / 1000;

    const toRemove: string[] = [];

    for (const [id, item] of this.groundItems) {
      const age = now - item.droppedAt;

      // Despawn
      if (item.ttlMs > 0 && age >= item.ttlMs) {
        toRemove.push(id);
        continue;
      }

      // Float animation: ±4px sine, 2s period
      const floatY = Math.sin(time * Math.PI) * 4;
      const bundle = this.spriteBundles.get(id);

      if (bundle) {
        const displayY = item.y + floatY;
        bundle.image.setPosition(item.x, displayY);
        bundle.text.setPosition(item.x + 8, displayY + 6);

        if (bundle.glow) {
          // Pulse glow radius 10 → 14 over 2s
          const r = 10 + Math.abs(Math.sin(time * Math.PI)) * 4;
          bundle.glow.setRadius(r).setPosition(item.x, displayY);
        }
        if (bundle.name) bundle.name.setPosition(item.x, displayY - 16);

        // Blink when near despawn
        if (item.ttlMs > 0) {
          const timeLeft = item.ttlMs - age;
          if (timeLeft <= BLINK_START_MS) {
            const blink = Math.floor(time * 2) % 2 === 0 ? 1.0 : 0.3;
            bundle.image.setAlpha(blink);
            bundle.text.setAlpha(blink);
          } else {
            bundle.image.setAlpha(1);
            bundle.text.setAlpha(1);
          }
        }
      }

      // Auto-pickup (resource items only)
      if (this.autoPickup && AUTO_PICKUP_TYPES.has(item.itemId)) {
        const dist = Math.hypot(item.x - playerX, item.y - playerY);
        if (dist <= PICKUP_RANGE_PX) {
          if (inventory.canAdd(item.itemId)) {
            inventory.add(item.itemId, item.amount);
            toRemove.push(id);
          }
        }
      }
    }

    for (const id of toRemove) {
      this.groundItems.delete(id);
      this.destroySprite(id);
    }
  }

  getAllItems(): GroundItem[] {
    return Array.from(this.groundItems.values());
  }

  destroy(): void {
    for (const id of this.spriteBundles.keys()) this.destroySprite(id);
    this.groundItems.clear();
  }
}
