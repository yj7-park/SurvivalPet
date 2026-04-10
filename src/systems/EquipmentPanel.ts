import { EquipmentSystem } from './EquipmentSystem';
import { Inventory } from './Inventory';
import { ARMOR_DEFS, SHIELD_DEFS } from '../config/equipment';

const ARMOR_ITEM_IDS  = new Set(Object.keys(ARMOR_DEFS));
const SHIELD_ITEM_IDS = new Set(Object.keys(SHIELD_DEFS));

export class EquipmentPanel {
  private panel: HTMLDivElement | null = null;

  constructor(
    private equipment: EquipmentSystem,
    private inventory: Inventory,
    private getEquippedWeaponId: () => string | null,
    private getCombatLevel: () => number,
  ) {}

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
    if (this.panel) this.refresh();
  }

  destroy(): void {
    this.close();
  }

  private open(): void {
    const panel = document.createElement('div');
    panel.id = 'equipment-panel';
    panel.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateX(170px);
      width: 240px; background: rgba(10,15,25,0.93);
      border: 1px solid #446; border-radius: 6px; padding: 10px; z-index: 200;
      color: #eee; font: 12px monospace; user-select: none;
    `;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:bold;color:#aad4ff">⚔ 장비 [E]</span>
        <button id="eq-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="eq-slots" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="eq-stats" style="margin-top:8px;padding-top:6px;border-top:1px solid #334;font-size:10px;color:#aaa"></div>
      <div id="eq-msg" style="font-size:10px;color:#ff8888;min-height:14px;margin-top:4px;text-align:center"></div>
    `;
    document.body.appendChild(panel);
    this.panel = panel;
    panel.querySelector('#eq-close')!.addEventListener('click', () => this.close());
    this.refresh();
  }

  private refresh(): void {
    if (!this.panel) return;
    const slotsDiv = this.panel.querySelector('#eq-slots') as HTMLDivElement;
    const statsDiv = this.panel.querySelector('#eq-stats') as HTMLDivElement;
    const msgDiv   = this.panel.querySelector('#eq-msg')   as HTMLDivElement;

    slotsDiv.innerHTML = '';
    msgDiv.textContent = '';

    const slots = this.equipment.getSlots();
    const weaponId = this.getEquippedWeaponId();

    // Armor slot
    slotsDiv.appendChild(this.makeSlotRow(
      '🦺 방어구',
      'armor',
      slots.armor,
      weaponId,
    ));

    // Shield slot
    const shieldRow = this.makeSlotRow(
      '🛡 방패',
      'shield',
      slots.shield,
      weaponId,
    );
    slotsDiv.appendChild(shieldRow);

    if (weaponId === 'bow' && !slots.shield) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:9px;color:#ff8888;margin-top:2px;';
      note.textContent = '※ 활은 방패 착용 불가';
      shieldRow.appendChild(note);
    }

    // Stats footer
    const defense     = this.equipment.totalDefense;
    const combatLvl   = this.getCombatLevel();
    const blockChance = this.equipment.totalBlockChance(combatLvl);
    const blockPct    = Math.round(blockChance * 100);

    statsDiv.textContent = `방어도: ${defense}   막기: ${blockPct}%${slots.shield ? '' : ' (방패 없음)'}`;
  }

  private makeSlotRow(
    label: string,
    slot: 'armor' | 'shield',
    currentItemId: string | null,
    weaponId: string | null,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex; align-items:center; gap:8px;
      padding:6px 8px; background:#1a2030; border:1px solid #334; border-radius:4px;
    `;

    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = 'flex:1; font-size:11px; color:#ccc;';
    labelDiv.textContent = label;
    row.appendChild(labelDiv);

    if (currentItemId) {
      const def = slot === 'armor' ? ARMOR_DEFS[currentItemId] : SHIELD_DEFS[currentItemId];
      const itemSpan = document.createElement('div');
      itemSpan.style.cssText = 'font-size:10px; color:#aaffaa; flex:2;';
      itemSpan.textContent = def?.label ?? currentItemId;
      row.appendChild(itemSpan);

      const unequipBtn = document.createElement('button');
      unequipBtn.textContent = '해제';
      unequipBtn.style.cssText = `
        padding:2px 6px; background:#2a2030; color:#ff8888;
        border:1px solid #664; border-radius:3px; font:9px monospace; cursor:pointer;
      `;
      unequipBtn.addEventListener('click', () => {
        const result = this.equipment.unequip(slot, this.inventory);
        if (!result.ok) {
          const msgDiv = this.panel?.querySelector('#eq-msg') as HTMLDivElement;
          if (msgDiv) msgDiv.textContent = result.reason;
        }
        this.refresh();
      });
      row.appendChild(unequipBtn);
    } else {
      const emptyLabel = document.createElement('div');
      emptyLabel.style.cssText = 'flex:2; font-size:9px; color:#555;';
      emptyLabel.textContent = '없음';
      row.appendChild(emptyLabel);

      const equipBtn = document.createElement('button');
      equipBtn.textContent = '장착';

      const inventoryItems = this.inventory.getAll();
      const candidates = inventoryItems.filter(({ key }) =>
        slot === 'armor' ? ARMOR_ITEM_IDS.has(key) : SHIELD_ITEM_IDS.has(key),
      );

      const canEquip = candidates.length > 0
        && this.equipment.canEquip(slot, '', weaponId).ok;

      equipBtn.disabled = !canEquip;
      equipBtn.style.cssText = `
        padding:2px 6px; background:${canEquip ? '#1a3a20' : '#1a1a1a'};
        color:${canEquip ? '#88ff88' : '#555'};
        border:1px solid ${canEquip ? '#446644' : '#334'};
        border-radius:3px; font:9px monospace; cursor:${canEquip ? 'pointer' : 'default'};
      `;

      if (canEquip && candidates.length > 0) {
        equipBtn.addEventListener('click', () => {
          this.openEquipPicker(slot, candidates.map(c => c.key), weaponId);
        });
      } else if (!canEquip && slot === 'shield' && weaponId === 'bow') {
        equipBtn.title = '활은 양손 무기입니다 — 방패를 착용할 수 없습니다';
      }
      row.appendChild(equipBtn);
    }

    return row;
  }

  private openEquipPicker(
    slot: 'armor' | 'shield',
    candidates: string[],
    weaponId: string | null,
  ): void {
    const existing = document.getElementById('eq-picker');
    existing?.remove();

    const picker = document.createElement('div');
    picker.id = 'eq-picker';
    picker.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%) translateX(170px) translateY(-200px);
      background:rgba(10,15,25,0.97); border:1px solid #446; border-radius:6px;
      padding:8px; z-index:300; color:#eee; font:11px monospace; min-width:180px;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:#e2b96f;margin-bottom:6px;';
    title.textContent = slot === 'armor' ? '방어구 선택' : '방패 선택';
    picker.appendChild(title);

    for (const itemId of candidates) {
      const def = slot === 'armor' ? ARMOR_DEFS[itemId] : SHIELD_DEFS[itemId];
      if (!def) continue;

      const btn = document.createElement('button');
      btn.style.cssText = `
        display:block; width:100%; padding:4px 8px; margin-bottom:4px;
        background:#1a2030; color:#ccc; border:1px solid #334; border-radius:3px;
        font:10px monospace; cursor:pointer; text-align:left;
      `;
      const info = slot === 'armor'
        ? `${def.label} (방어도 +${(def as typeof ARMOR_DEFS[string]).defense})`
        : `${def.label} (방어도 +${(def as typeof SHIELD_DEFS[string]).defense}, 막기 ${Math.round((def as typeof SHIELD_DEFS[string]).blockChance * 100)}%)`;
      btn.textContent = info;
      btn.addEventListener('click', () => {
        const result = this.equipment.equip(slot, itemId, this.inventory, weaponId);
        if (!result.ok) {
          const msgDiv = this.panel?.querySelector('#eq-msg') as HTMLDivElement;
          if (msgDiv) msgDiv.textContent = result.reason;
        }
        picker.remove();
        this.refresh();
      });
      picker.appendChild(btn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.style.cssText = `
      display:block; width:100%; padding:4px 8px;
      background:#2a1a1a; color:#888; border:1px solid #442; border-radius:3px;
      font:10px monospace; cursor:pointer;
    `;
    cancelBtn.addEventListener('click', () => picker.remove());
    picker.appendChild(cancelBtn);

    document.body.appendChild(picker);
  }
}
