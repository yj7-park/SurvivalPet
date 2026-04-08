export interface ItemStack {
  itemId: string;
  quantity: number;
}

export interface ShelfSlot {
  itemId: string | null;
  quantity: number;
}

// Maximum stack sizes for items
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

export class ShelfStorage {
  private slots: ShelfSlot[] = [];
  readonly SLOT_COUNT = 20;

  constructor() {
    for (let i = 0; i < this.SLOT_COUNT; i++) {
      this.slots.push({ itemId: null, quantity: 0 });
    }
  }

  getSlots(): ShelfSlot[] {
    return this.slots;
  }

  getSlot(index: number): ShelfSlot | null {
    if (index < 0 || index >= this.SLOT_COUNT) return null;
    return this.slots[index];
  }

  // Add items to shelf (tries to stack first, then finds empty slots)
  addItem(itemId: string, quantity: number): number {
    let remaining = quantity;
    const stackLimit = STACK_LIMITS[itemId] ?? DEFAULT_STACK;

    // First, try to stack on existing items
    for (const slot of this.slots) {
      if (slot.itemId === itemId && slot.quantity < stackLimit) {
        const canAdd = Math.min(remaining, stackLimit - slot.quantity);
        slot.quantity += canAdd;
        remaining -= canAdd;
        if (remaining === 0) return 0;
      }
    }

    // Then find empty slots
    for (const slot of this.slots) {
      if (slot.itemId === null) {
        const canAdd = Math.min(remaining, stackLimit);
        slot.itemId = itemId;
        slot.quantity = canAdd;
        remaining -= canAdd;
        if (remaining === 0) return 0;
      }
    }

    // Return items that couldn't be added
    return remaining;
  }

  // Remove items from a specific slot
  removeFromSlot(slotIndex: number, quantity: number): boolean {
    const slot = this.getSlot(slotIndex);
    if (!slot || !slot.itemId || slot.quantity < quantity) return false;
    slot.quantity -= quantity;
    if (slot.quantity === 0) {
      slot.itemId = null;
    }
    return true;
  }

  // Move items from one slot to another
  moveSlot(fromIndex: number, toIndex: number, quantity?: number): boolean {
    const fromSlot = this.getSlot(fromIndex);
    const toSlot = this.getSlot(toIndex);
    if (!fromSlot || !toSlot || !fromSlot.itemId) return false;

    const moveQty = quantity ?? fromSlot.quantity;
    if (moveQty > fromSlot.quantity) return false;

    // Check if destination can accept
    if (toSlot.itemId === null) {
      // Empty slot
      const stackLimit = STACK_LIMITS[fromSlot.itemId] ?? DEFAULT_STACK;
      const canAdd = Math.min(moveQty, stackLimit);
      toSlot.itemId = fromSlot.itemId;
      toSlot.quantity = canAdd;
      fromSlot.quantity -= canAdd;
      if (fromSlot.quantity === 0) fromSlot.itemId = null;
      return true;
    } else if (toSlot.itemId === fromSlot.itemId) {
      // Same item, try to stack
      const stackLimit = STACK_LIMITS[fromSlot.itemId] ?? DEFAULT_STACK;
      const canAdd = Math.min(moveQty, stackLimit - toSlot.quantity);
      toSlot.quantity += canAdd;
      fromSlot.quantity -= canAdd;
      if (fromSlot.quantity === 0) fromSlot.itemId = null;
      return true;
    }

    return false;
  }

  // Clear all slots
  clear(): void {
    for (let i = 0; i < this.SLOT_COUNT; i++) {
      this.slots[i] = { itemId: null, quantity: 0 };
    }
  }

  // Get all non-empty items
  getAll(): ItemStack[] {
    return this.slots
      .filter(s => s.itemId !== null)
      .map(s => ({ itemId: s.itemId!, quantity: s.quantity }));
  }

  // Get total item count of a specific item
  getTotalOf(itemId: string): number {
    let total = 0;
    for (const slot of this.slots) {
      if (slot.itemId === itemId) {
        total += slot.quantity;
      }
    }
    return total;
  }

  // Check if shelf has space for an item
  hasSpace(itemId: string, quantity: number): boolean {
    const remaining = this.addItem(itemId, 0); // Test add with 0
    const neededSpace = Math.ceil(quantity / (STACK_LIMITS[itemId] ?? DEFAULT_STACK));
    const freeSlots = this.slots.filter(s => s.itemId === null).length;
    return freeSlots >= neededSpace;
  }
}
