import Phaser from 'phaser';
import { ShelfStorage, ShelfSlot } from './ShelfStorage';
import { Inventory } from './Inventory';

const ITEM_NAMES: Record<string, string> = {
  item_wood: '목재',
  item_stone: '석재',
  item_processed_stone: '가공석',
  item_fish: '물고기',
  item_cooked_fish: '구운 생선',
  item_raw_meat: '날고기',
  item_cooked_meat: '구운 고기',
  item_hide: '가죽',
  item_tiger_fang: '호랑이 이빨',
  item_bow: '활',
  item_sword_wood: '나무칼',
  item_sword_stone: '석재칼',
  item_fishing_rod: '낚싯대',
  item_torch: '횃불',
};

function itemEmoji(itemId: string): string {
  const map: Record<string, string> = {
    item_wood: '🪵',
    item_stone: '🪨',
    item_processed_stone: '🧱',
    item_fish: '🐟',
    item_cooked_fish: '🍴',
    item_raw_meat: '🥩',
    item_cooked_meat: '🍖',
    item_hide: '🦺',
    item_tiger_fang: '🦷',
    item_bow: '🏹',
    item_sword_wood: '🗡',
    item_sword_stone: '⚔',
    item_fishing_rod: '🎣',
    item_torch: '🔥',
  };
  return map[itemId] ?? '📦';
}

export class ShelfUI {
  private panel: HTMLDivElement | null = null;
  private shelfStorage: ShelfStorage | null = null;
  private playerInventory: Inventory | null = null;
  private scene: Phaser.Scene | null = null;
  private shelfId: string | null = null;
  private distanceCheckInterval: number | null = null;
  private playerPos: { x: number; y: number } | null = null;
  private shelfPos: { x: number; y: number } | null = null;

  constructor() {}

  open(
    scene: Phaser.Scene,
    shelfId: string,
    shelfStorage: ShelfStorage,
    playerInventory: Inventory,
    playerX: number,
    playerY: number,
    shelfX: number,
    shelfY: number,
  ): void {
    this.close(); // Close any existing panel first

    this.scene = scene;
    this.shelfId = shelfId;
    this.shelfStorage = shelfStorage;
    this.playerInventory = playerInventory;
    this.playerPos = { x: playerX, y: playerY };
    this.shelfPos = { x: shelfX, y: shelfY };

    this.createPanel();
    this.startDistanceCheck();
  }

  close(): void {
    this.panel?.remove();
    this.panel = null;
    this.shelfStorage = null;
    this.playerInventory = null;
    this.scene = null;
    if (this.distanceCheckInterval !== null) {
      window.clearInterval(this.distanceCheckInterval);
      this.distanceCheckInterval = null;
    }
  }

  private createPanel(): void {
    if (!this.shelfStorage || !this.playerInventory) return;

    const panel = document.createElement('div');
    panel.id = 'shelf-panel';
    panel.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 700px; background: rgba(10,15,25,0.95);
      border: 2px solid #446; border-radius: 8px; padding: 12px; z-index: 200;
      color: #eee; font: 12px monospace; user-select: none;
      max-height: 500px; overflow-y: auto;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #334;
    `;
    header.innerHTML = `
      <span style="font-weight:bold;color:#e2b96f">📦 선반 인벤토리</span>
      <button id="shelf-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
    `;

    // Two-column layout
    const container = document.createElement('div');
    container.style.cssText = `
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    `;

    // Player inventory column
    const playerCol = document.createElement('div');
    playerCol.innerHTML = `
      <div style="font-weight:bold;color:#e2b96f;margin-bottom:8px">🎒 내 인벤토리</div>
      <div id="player-slots" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:8px"></div>
      <div id="player-tooltip" style="font-size:10px;color:#aaa;min-height:16px;text-align:center"></div>
    `;

    // Shelf column
    const shelfCol = document.createElement('div');
    shelfCol.innerHTML = `
      <div style="font-weight:bold;color:#e2b96f;margin-bottom:8px">선반 (20칸)</div>
      <div id="shelf-slots" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:8px"></div>
      <div id="shelf-tooltip" style="font-size:10px;color:#aaa;min-height:16px;text-align:center"></div>
    `;

    container.appendChild(playerCol);
    container.appendChild(shelfCol);

    // Footer with buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: 12px; padding-top: 8px; border-top: 1px solid #334;
      display: flex; gap: 8px;
    `;
    footer.innerHTML = `
      <button id="shelf-move-all" style="
        flex: 1; padding: 6px 12px;
        background: #2a4a2a; border: 1px solid #4a7a4a; color: #aaffaa;
        border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 11px;
      ">→ 전부 이동</button>
      <button id="shelf-take-all" style="
        flex: 1; padding: 6px 12px;
        background: #2a2a4a; border: 1px solid #4a4a7a; color: #aaaaff;
        border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 11px;
      ">← 전부 꺼내기</button>
    `;

    panel.appendChild(header);
    panel.appendChild(container);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    this.panel = panel;

    // Attach event listeners
    panel.querySelector('#shelf-close')!.addEventListener('click', () => this.close());
    panel.querySelector('#shelf-move-all')!.addEventListener('click', () => this.moveAllToShelf());
    panel.querySelector('#shelf-take-all')!.addEventListener('click', () => this.takeAllFromShelf());

    this.refreshPanel();
  }

  private refreshPanel(): void {
    if (!this.panel || !this.shelfStorage || !this.playerInventory) return;

    const playerSlotsContainer = this.panel.querySelector('#player-slots') as HTMLDivElement;
    const shelfSlotsContainer = this.panel.querySelector('#shelf-slots') as HTMLDivElement;
    const playerTooltip = this.panel.querySelector('#player-tooltip') as HTMLDivElement;
    const shelfTooltip = this.panel.querySelector('#shelf-tooltip') as HTMLDivElement;

    playerSlotsContainer.innerHTML = '';
    shelfSlotsContainer.innerHTML = '';

    // Player inventory (simple 10-slot display)
    const playerItems = this.playerInventory.getAll();
    const playerSlotMap = new Map<string, number>();
    for (const { key, count } of playerItems) {
      playerSlotMap.set(key, count);
    }

    const playerKeys = Array.from(playerSlotMap.keys());
    for (let i = 0; i < 10; i++) {
      const itemId = playerKeys[i] ?? null;
      const qty = itemId ? playerSlotMap.get(itemId) ?? 0 : 0;

      const slotEl = this.createSlotElement(itemId, qty, true, playerTooltip);
      if (itemId) {
        // 좌클릭: 1개 선반으로 이동
        slotEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveOneToShelf(itemId);
        });
        // 우클릭: 전부 선반으로 이동
        slotEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.moveAllOfItemToShelf(itemId);
        });
      }
      playerSlotsContainer.appendChild(slotEl);
    }

    // Shelf inventory (20 slots)
    const shelfSlots = this.shelfStorage.getSlots();
    for (let i = 0; i < this.shelfStorage.SLOT_COUNT; i++) {
      const slot = shelfSlots[i];
      const slotEl = this.createSlotElement(slot.itemId, slot.quantity, false, shelfTooltip, i);
      if (slot.itemId) {
        const slotIndex = i;
        // 좌클릭: 1개 플레이어 인벤으로 이동
        slotEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveOneFromShelf(slotIndex, shelfTooltip);
        });
        // 우클릭: 해당 슬롯 전부 플레이어 인벤으로 이동
        slotEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.moveAllFromShelfSlot(slotIndex, shelfTooltip);
        });
      }
      shelfSlotsContainer.appendChild(slotEl);
    }
  }

  private createSlotElement(
    itemId: string | null,
    quantity: number,
    isPlayerSlot: boolean,
    tooltip: HTMLDivElement,
    shelfIndex?: number,
  ): HTMLDivElement {
    const slot = document.createElement('div');
    slot.style.cssText = `
      width: 52px; height: 52px; background: ${itemId ? '#1a2030' : '#0f1820'};
      border: 1px solid #334; border-radius: 3px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; cursor: ${itemId ? 'pointer' : 'default'};
      position: relative; font-size: 9px; text-align: center; padding: 2px; box-sizing: border-box;
    `;

    if (itemId) {
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size: 16px; line-height: 1; margin-bottom: 2px;';
      icon.textContent = itemEmoji(itemId);
      slot.appendChild(icon);

      const label = document.createElement('div');
      label.style.cssText = 'color: #ccc; word-break: break-all; line-height: 1; font-size: 8px;';
      label.textContent = ITEM_NAMES[itemId] ?? itemId.replace('item_', '');
      slot.appendChild(label);

      const countDiv = document.createElement('div');
      countDiv.style.cssText = 'position: absolute; bottom: 2px; right: 2px; color: #888; font-size: 8px;';
      countDiv.textContent = `${quantity}`;
      slot.appendChild(countDiv);

      const moveHint = isPlayerSlot
        ? '클릭: 1개 이동 / 우클릭: 전부 이동'
        : '클릭: 1개 꺼내기 / 우클릭: 전부 꺼내기';
      slot.addEventListener('mouseenter', () => {
        slot.style.background = '#2a3040';
        tooltip.textContent = `${ITEM_NAMES[itemId] ?? itemId} ×${quantity} / ${moveHint}`;
      });
      slot.addEventListener('mouseleave', () => {
        slot.style.background = '#1a2030';
        tooltip.textContent = '';
      });
    }

    return slot;
  }

  private moveAllToShelf(): void {
    if (!this.shelfStorage || !this.playerInventory) return;

    const playerItems = this.playerInventory.getAll();
    for (const { key, count } of playerItems) {
      const remaining = this.shelfStorage.addItem(key, count);
      const moved = count - remaining;
      if (moved > 0) {
        this.playerInventory.remove(key, moved);
      }
    }

    this.refreshPanel();
  }

  private takeAllFromShelf(): void {
    if (!this.shelfStorage || !this.playerInventory) return;

    const shelfItems = this.shelfStorage.getAll();
    for (const { itemId, quantity } of shelfItems) {
      let remaining = quantity;
      for (let moved = 0; moved < quantity; moved++) {
        if (!this.playerInventory.canAdd(itemId)) break;
        this.playerInventory.add(itemId, 1);
        remaining--;
      }
      const movedCount = quantity - remaining;
      if (movedCount > 0) {
        // Remove moved items from shelf (find and reduce slots)
        let toRemove = movedCount;
        for (let i = 0; i < this.shelfStorage.SLOT_COUNT && toRemove > 0; i++) {
          const slot = this.shelfStorage.getSlot(i);
          if (slot?.itemId === itemId) {
            const take = Math.min(toRemove, slot.quantity);
            this.shelfStorage.removeFromSlot(i, take);
            toRemove -= take;
          }
        }
      }
    }

    this.refreshPanel();
  }

  private moveOneToShelf(itemId: string): void {
    if (!this.shelfStorage || !this.playerInventory) return;
    if (!this.playerInventory.has(itemId, 1)) return;

    const remaining = this.shelfStorage.addItem(itemId, 1);
    if (remaining === 0) {
      this.playerInventory.remove(itemId, 1);
    }

    this.refreshPanel();
  }

  private moveAllOfItemToShelf(itemId: string): void {
    if (!this.shelfStorage || !this.playerInventory) return;
    const count = this.playerInventory.get(itemId);
    if (count === 0) return;

    const remaining = this.shelfStorage.addItem(itemId, count);
    const moved = count - remaining;
    if (moved > 0) {
      this.playerInventory.remove(itemId, moved);
    }

    this.refreshPanel();
  }

  private moveOneFromShelf(slotIndex: number, tooltip: HTMLDivElement): void {
    if (!this.shelfStorage || !this.playerInventory) return;
    const slot = this.shelfStorage.getSlot(slotIndex);
    if (!slot?.itemId) return;

    if (!this.playerInventory.canAdd(slot.itemId)) {
      tooltip.textContent = '인벤토리 가득 참';
      this.highlightShelfSlotFull(slotIndex);
      return;
    }

    this.shelfStorage.removeFromSlot(slotIndex, 1);
    this.playerInventory.add(slot.itemId, 1);
    this.refreshPanel();
  }

  private moveAllFromShelfSlot(slotIndex: number, tooltip: HTMLDivElement): void {
    if (!this.shelfStorage || !this.playerInventory) return;
    const slot = this.shelfStorage.getSlot(slotIndex);
    if (!slot?.itemId) return;

    if (!this.playerInventory.canAdd(slot.itemId)) {
      tooltip.textContent = '인벤토리 가득 참';
      this.highlightShelfSlotFull(slotIndex);
      return;
    }

    const itemId = slot.itemId;
    let moved = 0;
    while (this.shelfStorage.getSlot(slotIndex)?.itemId === itemId) {
      if (!this.playerInventory.canAdd(itemId)) break;
      if (!this.shelfStorage.removeFromSlot(slotIndex, 1)) break;
      this.playerInventory.add(itemId, 1);
      moved++;
    }

    if (moved > 0) this.refreshPanel();
  }

  private highlightShelfSlotFull(slotIndex: number): void {
    if (!this.panel) return;
    const shelfSlotsContainer = this.panel.querySelector('#shelf-slots') as HTMLDivElement;
    const slotEl = shelfSlotsContainer?.children[slotIndex] as HTMLDivElement;
    if (!slotEl) return;
    slotEl.style.border = '1px solid #ff4444';
    setTimeout(() => {
      slotEl.style.border = '1px solid #334';
    }, 1000);
  }

  private startDistanceCheck(): void {
    if (this.distanceCheckInterval !== null) {
      window.clearInterval(this.distanceCheckInterval);
    }

    this.distanceCheckInterval = window.setInterval(() => {
      if (!this.playerPos || !this.shelfPos) {
        this.close();
        return;
      }

      // Check if player is more than 2 tiles (64px) away from shelf
      const dist = Math.hypot(
        this.playerPos.x - this.shelfPos.x,
        this.playerPos.y - this.shelfPos.y,
      );
      if (dist > 64) {
        this.close();
      }
    }, 100); // Check every 100ms
  }

  updatePlayerPosition(x: number, y: number): void {
    this.playerPos = { x, y };
  }
}
