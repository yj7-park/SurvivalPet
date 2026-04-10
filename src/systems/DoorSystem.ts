import { TILE_SIZE } from '../world/MapGenerator';

export interface DoorState {
  buildingId: string;
  open: boolean;
  lockedBy: string | null;
}

const DOOR_INTERACT_RANGE = 48; // px

export class DoorSystem {
  private doors = new Map<string, DoorState>();
  private positions = new Map<string, { wx: number; wy: number }>();

  registerDoor(buildingId: string, tileX: number, tileY: number, open = false): void {
    this.doors.set(buildingId, { buildingId, open, lockedBy: null });
    this.positions.set(buildingId, {
      wx: tileX * TILE_SIZE + TILE_SIZE / 2,
      wy: tileY * TILE_SIZE + TILE_SIZE / 2,
    });
  }

  unregisterDoor(buildingId: string): void {
    this.doors.delete(buildingId);
    this.positions.delete(buildingId);
  }

  /** Toggle door open/closed. Returns true if successful. */
  interact(buildingId: string, playerId: string): boolean {
    const door = this.doors.get(buildingId);
    if (!door) return false;
    if (door.lockedBy !== null && door.lockedBy !== playerId) return false;
    door.open = !door.open;
    return true;
  }

  toggleLock(buildingId: string, playerId: string): void {
    const door = this.doors.get(buildingId);
    if (!door) return;
    door.lockedBy = door.lockedBy === playerId ? null : playerId;
  }

  isOpen(buildingId: string): boolean {
    return this.doors.get(buildingId)?.open ?? false;
  }

  isLocked(buildingId: string): boolean {
    const door = this.doors.get(buildingId);
    return (door?.lockedBy ?? null) !== null;
  }

  getState(buildingId: string): DoorState | null {
    return this.doors.get(buildingId) ?? null;
  }

  setOpen(buildingId: string, open: boolean): void {
    const door = this.doors.get(buildingId);
    if (door) door.open = open;
  }

  /** Returns the nearest door within range, or null. */
  getNearestInRange(px: number, py: number, range = DOOR_INTERACT_RANGE): { id: string; door: DoorState } | null {
    let best: { id: string; door: DoorState } | null = null;
    let bestDist = range;
    for (const [id, pos] of this.positions) {
      const d = Math.hypot(px - pos.wx, py - pos.wy);
      if (d < bestDist) {
        bestDist = d;
        const door = this.doors.get(id);
        if (door) best = { id, door };
      }
    }
    return best;
  }

  hasDoorNearby(px: number, py: number, range = DOOR_INTERACT_RANGE): boolean {
    return this.getNearestInRange(px, py, range) !== null;
  }

  clear(): void {
    this.doors.clear();
    this.positions.clear();
  }
}
