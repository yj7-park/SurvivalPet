import { ARMOR_DEFS, SHIELD_DEFS, TWO_HANDED_WEAPONS, EquipmentSlots } from '../config/equipment';
import { Inventory } from './Inventory';

export type EquipResult = { ok: true } | { ok: false; reason: string };

export class EquipmentSystem {
  private slots: EquipmentSlots = { armor: null, shield: null };

  equip(
    slot: keyof EquipmentSlots,
    itemId: string,
    inventory: Inventory,
    equippedWeaponId: string | null = null,
  ): EquipResult {
    const can = this.canEquip(slot, itemId, equippedWeaponId);
    if (!can.ok) return { ok: false, reason: can.reason! };

    const current = this.slots[slot];
    if (current) {
      if (!inventory.canAdd(current)) {
        return { ok: false, reason: '인벤토리가 가득 찼습니다' };
      }
      inventory.add(current, 1);
    }

    inventory.remove(itemId, 1);
    this.slots[slot] = itemId;
    return { ok: true };
  }

  unequip(slot: keyof EquipmentSlots, inventory: Inventory): EquipResult {
    const current = this.slots[slot];
    if (!current) return { ok: false, reason: '장착된 아이템 없음' };
    if (!inventory.canAdd(current)) {
      return { ok: false, reason: '인벤토리가 가득 찼습니다' };
    }
    inventory.add(current, 1);
    this.slots[slot] = null;
    return { ok: true };
  }

  canEquip(
    slot: keyof EquipmentSlots,
    _itemId: string,
    equippedWeaponId: string | null = null,
  ): { ok: boolean; reason?: string } {
    if (slot === 'shield' && TWO_HANDED_WEAPONS.has(equippedWeaponId ?? '')) {
      return { ok: false, reason: '활은 양손 무기입니다 — 방패를 착용할 수 없습니다' };
    }
    return { ok: true };
  }

  /** 양손 무기 장착 시 방패 자동 해제 */
  handleWeaponEquip(weaponId: string | null, inventory: Inventory): void {
    if (weaponId && TWO_HANDED_WEAPONS.has(weaponId) && this.slots.shield) {
      inventory.add(this.slots.shield, 1);
      this.slots.shield = null;
    }
  }

  getSlots(): Readonly<EquipmentSlots> {
    return { ...this.slots };
  }

  get totalDefense(): number {
    const armorDef  = ARMOR_DEFS[this.slots.armor   ?? '']?.defense ?? 0;
    const shieldDef = SHIELD_DEFS[this.slots.shield ?? '']?.defense ?? 0;
    return armorDef + shieldDef;
  }

  totalBlockChance(combatLevel: number): number {
    const base  = SHIELD_DEFS[this.slots.shield ?? '']?.blockChance ?? 0;
    const bonus = (combatLevel - 1) * 0.01;
    return Math.min(0.75, base + bonus);
  }
}
