import {
  ref, set, push, onValue, onChildAdded, onChildRemoved,
  onDisconnect, off, remove, get, Database, DatabaseReference,
} from 'firebase/database';
import { initFirebase, isFirebaseConfigured } from '../config/firebase';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface RemotePlayerState {
  id: string;
  name: string;
  skin: number;
  x: number; y: number;
  renderX: number; renderY: number;
  mapX: number; mapY: number;
  hp: number; maxHp?: number; hunger: number; fatigue: number;
  facing: Direction;
  isMoving: boolean;
  weapon: string | null;
  frenzy: boolean;
  online: boolean;
  lastSeen: number;
  playerColor?: number;
  afkSeconds?: number;
}

export interface WorldBuildingEntry {
  id: string;
  type: string;
  mapX: number; mapY: number;
  tileX: number; tileY: number;
  durability: number;
  material: 'wood' | 'stone';
  builtBy: string;
}

export interface CharacterInitData {
  name: string;
  skin: number;
  x: number; y: number;
  mapX: number; mapY: number;
  hp: number; hunger: number; fatigue: number;
  facing: Direction;
  weapon: string | null;
}

export class MultiplayerSystem {
  private enabled = false;
  private db!: Database;
  private playersRef!: DatabaseReference;
  private isJoined = false;
  private remotePlayers = new Map<string, RemotePlayerState>();
  private lastUpload = 0;

  private onPlayersChangedCb?: (players: RemotePlayerState[]) => void;
  private onBuildingAddedCb?: (entry: WorldBuildingEntry) => void;
  private onBuildingRemovedCb?: (id: string, mapX: number, mapY: number, tileX: number, tileY: number) => void;
  private onTreeCutCb?: (mapX: number, mapY: number, tileX: number, tileY: number) => void;
  private onRockMinedCb?: (mapX: number, mapY: number, tileX: number, tileY: number) => void;
  private onCampfireChangedCb?: (id: string, data: { fuelMs: number; lit: boolean } | null) => void;
  private onFarmChangedCb?: (mapKey: string, tileKey: string, data: { type: string; stage: number; growthProgress: number; isWet: boolean } | null) => void;

  private localName = '생존자';
  private localSkin = 0;
  private worldListenerRefs: DatabaseReference[] = [];

  private lastUploadedPos = { x: 0, y: 0 };
  private lastUploadedStats = { hp: 0, hunger: 0, fatigue: 0 };
  private static readonly POSITION_THRESHOLD = 2;
  private static readonly STAT_THRESHOLD = 2;

  constructor(private seed: string, private playerId: string) {}

  get isEnabled(): boolean { return this.enabled && this.isJoined; }

  setLocalInfo(name: string, skin: number): void {
    this.localName = name;
    this.localSkin = skin;
  }

  async joinRoom(initData: CharacterInitData): Promise<void> {
    if (!isFirebaseConfigured()) return;
    try {
      this.db = initFirebase();
      this.playersRef = ref(this.db, `rooms/${this.seed}/players`);

      const myPlayerRef = ref(this.db, `rooms/${this.seed}/players/${this.playerId}`);
      await set(myPlayerRef, {
        name: initData.name,
        skin: initData.skin,
        x: initData.x, y: initData.y,
        mapX: initData.mapX, mapY: initData.mapY,
        hp: initData.hp, hunger: initData.hunger, fatigue: initData.fatigue,
        facing: initData.facing,
        isMoving: false,
        weapon: initData.weapon,
        frenzy: false,
        online: true,
        lastSeen: Date.now(),
      });

      onDisconnect(ref(this.db, `rooms/${this.seed}/players/${this.playerId}/online`)).set(false);
      onDisconnect(ref(this.db, `rooms/${this.seed}/players/${this.playerId}/lastSeen`)).set(Date.now());

      this.listenPlayers();
      this.listenWorld();

      this.enabled = true;
      this.isJoined = true;

      // 입장 시스템 메시지
      this.sendSystemMessage(`★ ${initData.name}님이 입장했습니다`);
    } catch (e) {
      console.warn('Multiplayer join failed:', e);
    }
  }

  async leaveRoom(): Promise<void> {
    if (!this.isJoined) return;
    try {
      // 퇴장 시스템 메시지 (leaveRoom 전에 전송)
      this.sendSystemMessage(`★ ${this.localName}님이 퇴장했습니다`);
      await set(ref(this.db, `rooms/${this.seed}/players/${this.playerId}/online`), false);
      await set(ref(this.db, `rooms/${this.seed}/players/${this.playerId}/lastSeen`), Date.now());
      off(this.playersRef);
      for (const r of this.worldListenerRefs) off(r);
      this.worldListenerRefs = [];
      this.isJoined = false;
    } catch (_) {}
  }

  uploadState(
    now: number,
    x: number, y: number, mapX: number, mapY: number,
    facing: Direction, isMoving: boolean,
    hp: number, hunger: number, fatigue: number,
    frenzy: boolean, weapon: string | null,
  ): void {
    if (!this.isEnabled) return;
    const threshold = isMoving ? 100 : 2000;
    if (now - this.lastUpload < threshold) return;

    const PT = MultiplayerSystem.POSITION_THRESHOLD;
    const ST = MultiplayerSystem.STAT_THRESHOLD;
    const posUnchanged =
      Math.abs(x - this.lastUploadedPos.x) < PT &&
      Math.abs(y - this.lastUploadedPos.y) < PT;
    const statsUnchanged =
      Math.abs(hp - this.lastUploadedStats.hp) < ST &&
      Math.abs(hunger - this.lastUploadedStats.hunger) < ST &&
      Math.abs(fatigue - this.lastUploadedStats.fatigue) < ST;
    if (posUnchanged && statsUnchanged && !isMoving) return;

    this.lastUpload = now;
    this.lastUploadedPos = { x, y };
    this.lastUploadedStats = { hp, hunger, fatigue };
    set(ref(this.db, `rooms/${this.seed}/players/${this.playerId}`), {
      name: this.localName, skin: this.localSkin,
      x, y, mapX, mapY, facing, isMoving,
      hp, hunger, fatigue, frenzy, weapon,
      online: true, lastSeen: Date.now(),
    });
  }

  /** Force-upload position immediately (e.g. on map transition) */
  forceUploadPosition(x: number, y: number, mapX: number, mapY: number, facing: Direction): void {
    if (!this.isEnabled) return;
    this.lastUpload = 0; // reset throttle
    set(ref(this.db, `rooms/${this.seed}/players/${this.playerId}`), {
      name: this.localName, skin: this.localSkin,
      x, y, mapX, mapY, facing, isMoving: false,
      hp: 0, hunger: 0, fatigue: 0, frenzy: false, weapon: null,
      online: true, lastSeen: Date.now(),
    });
  }

  uploadBuildingAdded(entry: Omit<WorldBuildingEntry, 'id'>): string {
    if (!this.isEnabled) return '';
    const buildingsRef = ref(this.db, `rooms/${this.seed}/world/buildings`);
    const newRef = push(buildingsRef);
    set(newRef, entry);
    return newRef.key ?? '';
  }

  uploadBuildingRemoved(firebaseId: string): void {
    if (!this.isEnabled || !firebaseId) return;
    remove(ref(this.db, `rooms/${this.seed}/world/buildings/${firebaseId}`));
  }

  uploadTreeCut(mapX: number, mapY: number, tileX: number, tileY: number): void {
    if (!this.isEnabled) return;
    const id = `${mapX}_${mapY}_${tileX}_${tileY}`;
    set(ref(this.db, `rooms/${this.seed}/world/cutTrees/${id}`), {
      mapX, mapY, tileX, tileY, cutAt: Date.now(),
    });
  }

  uploadRockMined(mapX: number, mapY: number, tileX: number, tileY: number): void {
    if (!this.isEnabled) return;
    const id = `${mapX}_${mapY}_${tileX}_${tileY}`;
    set(ref(this.db, `rooms/${this.seed}/world/minedRocks/${id}`), {
      mapX, mapY, tileX, tileY, minedAt: Date.now(),
    });
  }

  static async getPlayerCount(seed: string): Promise<number> {
    if (!isFirebaseConfigured()) return 0;
    try {
      const db = initFirebase();
      const snap = await get(ref(db, `rooms/${seed}/players`));
      if (!snap.exists()) return 0;
      const data = snap.val() as Record<string, { online?: boolean; lastSeen?: number }>;
      const now = Date.now();
      return Object.values(data).filter(p => p.online && now - (p.lastSeen ?? 0) < 30000).length;
    } catch { return 0; }
  }

  update(delta: number): void {
    if (!this.enabled) return;
    const LERP = 1 - Math.pow(0.01, delta / 1000);
    for (const p of this.remotePlayers.values()) {
      p.renderX += (p.x - p.renderX) * LERP;
      p.renderY += (p.y - p.renderY) * LERP;
    }
  }

  getAllRemotePlayers(): RemotePlayerState[] { return [...this.remotePlayers.values()]; }

  getRemotePlayersOnMap(mapX: number, mapY: number): RemotePlayerState[] {
    return [...this.remotePlayers.values()].filter(p => p.mapX === mapX && p.mapY === mapY);
  }

  onPlayersChanged(cb: (players: RemotePlayerState[]) => void): void { this.onPlayersChangedCb = cb; }
  onBuildingAdded(cb: (entry: WorldBuildingEntry) => void): void { this.onBuildingAddedCb = cb; }
  onBuildingRemoved(cb: (id: string, mapX: number, mapY: number, tileX: number, tileY: number) => void): void { this.onBuildingRemovedCb = cb; }
  onTreeCut(cb: (mapX: number, mapY: number, tileX: number, tileY: number) => void): void { this.onTreeCutCb = cb; }
  onRockMined(cb: (mapX: number, mapY: number, tileX: number, tileY: number) => void): void { this.onRockMinedCb = cb; }
  onCampfireChanged(cb: (id: string, data: { fuelMs: number; lit: boolean } | null) => void): void { this.onCampfireChangedCb = cb; }
  onFarmChanged(cb: (mapKey: string, tileKey: string, data: { type: string; stage: number; growthProgress: number; isWet: boolean } | null) => void): void { this.onFarmChangedCb = cb; }

  uploadFarmPlant(mapX: number, mapY: number, tileX: number, tileY: number, type: string): void {
    if (!this.isEnabled) return;
    const mapKey = `${mapX}_${mapY}`;
    const tileKey = `${tileX}_${tileY}`;
    set(ref(this.db, `rooms/${this.seed}/farms/${mapKey}/${tileKey}`), { type, stage: 0, growthProgress: 0, isWet: false });
  }

  uploadFarmHarvest(mapX: number, mapY: number, tileX: number, tileY: number): void {
    if (!this.isEnabled) return;
    const mapKey = `${mapX}_${mapY}`;
    const tileKey = `${tileX}_${tileY}`;
    set(ref(this.db, `rooms/${this.seed}/farms/${mapKey}/${tileKey}`), null);
  }

  uploadCampfireFuel(id: string, fuelMs: number): void {
    if (!this.isEnabled) return;
    set(ref(this.db, `rooms/${this.seed}/campfires/${id}/fuelMs`), fuelMs);
  }

  uploadCampfireLit(id: string, lit: boolean): void {
    if (!this.isEnabled) return;
    set(ref(this.db, `rooms/${this.seed}/campfires/${id}/lit`), lit);
  }
  /** 시스템 메시지를 Firebase chat에 직접 전송 */
  sendSystemMessage(text: string): void {
    if (!this.db || !this.seed) return;
    push(ref(this.db, `rooms/${this.seed}/chat`), {
      playerId: 'system',
      playerName: 'system',
      text,
      type: 'system',
      timestamp: Date.now(),
      color: '#aaaaaa',
    });
  }

  private listenPlayers(): void {
    onValue(this.playersRef, (snap) => {
      const data = snap.val() as Record<string, Partial<RemotePlayerState>> | null;
      if (!data) {
        this.remotePlayers.clear();
        this.onPlayersChangedCb?.([]);
        return;
      }
      const now = Date.now();
      const activeIds = new Set<string>();
      for (const [id, raw] of Object.entries(data)) {
        if (id === this.playerId) continue;
        if (!raw.online || now - (raw.lastSeen ?? 0) > 10 * 60 * 1000) continue;
        activeIds.add(id);
        const existing = this.remotePlayers.get(id);
        const p: RemotePlayerState = {
          id, name: raw.name ?? '???', skin: raw.skin ?? 0,
          x: raw.x ?? 0, y: raw.y ?? 0,
          renderX: existing?.renderX ?? (raw.x ?? 0),
          renderY: existing?.renderY ?? (raw.y ?? 0),
          mapX: raw.mapX ?? 0, mapY: raw.mapY ?? 0,
          hp: raw.hp ?? 0, hunger: raw.hunger ?? 0, fatigue: raw.fatigue ?? 0,
          facing: (raw.facing as Direction) ?? 'down',
          isMoving: raw.isMoving ?? false,
          weapon: raw.weapon ?? null,
          frenzy: raw.frenzy ?? false,
          online: true,
          lastSeen: raw.lastSeen ?? now,
        };
        this.remotePlayers.set(id, p);
      }
      for (const id of this.remotePlayers.keys()) {
        if (!activeIds.has(id)) this.remotePlayers.delete(id);
      }
      this.onPlayersChangedCb?.([...this.remotePlayers.values()]);
    });
  }

  private listenWorld(): void {
    const applied = { buildings: new Set<string>(), trees: new Set<string>(), rocks: new Set<string>() };

    const buildingsRef = ref(this.db, `rooms/${this.seed}/world/buildings`);
    this.worldListenerRefs.push(buildingsRef);
    onChildAdded(buildingsRef, (snap) => {
      const id = snap.key!;
      if (applied.buildings.has(id)) return;
      applied.buildings.add(id);
      const entry = snap.val() as Omit<WorldBuildingEntry, 'id'>;
      this.onBuildingAddedCb?.({ ...entry, id });
    });
    onChildRemoved(buildingsRef, (snap) => {
      const id = snap.key!;
      applied.buildings.delete(id);
      const entry = snap.val() as Omit<WorldBuildingEntry, 'id'>;
      this.onBuildingRemovedCb?.(id, entry.mapX, entry.mapY, entry.tileX, entry.tileY);
    });

    const treesRef = ref(this.db, `rooms/${this.seed}/world/cutTrees`);
    this.worldListenerRefs.push(treesRef);
    onChildAdded(treesRef, (snap) => {
      const id = snap.key!;
      if (applied.trees.has(id)) return;
      applied.trees.add(id);
      const e = snap.val() as { mapX: number; mapY: number; tileX: number; tileY: number };
      this.onTreeCutCb?.(e.mapX, e.mapY, e.tileX, e.tileY);
    });

    const rocksRef = ref(this.db, `rooms/${this.seed}/world/minedRocks`);
    this.worldListenerRefs.push(rocksRef);
    onChildAdded(rocksRef, (snap) => {
      const id = snap.key!;
      if (applied.rocks.has(id)) return;
      applied.rocks.add(id);
      const e = snap.val() as { mapX: number; mapY: number; tileX: number; tileY: number };
      this.onRockMinedCb?.(e.mapX, e.mapY, e.tileX, e.tileY);
    });

    const campfiresRef = ref(this.db, `rooms/${this.seed}/campfires`);
    this.worldListenerRefs.push(campfiresRef);
    onValue(campfiresRef, (snap) => {
      const data = snap.val() as Record<string, { fuelMs: number; lit: boolean }> | null;
      if (!data) return;
      for (const [id, val] of Object.entries(data)) {
        this.onCampfireChangedCb?.(id, val);
      }
    });

    const farmsRef = ref(this.db, `rooms/${this.seed}/farms`);
    this.worldListenerRefs.push(farmsRef);
    onValue(farmsRef, (snap) => {
      const data = snap.val() as Record<string, Record<string, { type: string; stage: number; growthProgress: number; isWet: boolean }>> | null;
      if (!data) return;
      for (const [mapKey, tiles] of Object.entries(data)) {
        for (const [tileKey, val] of Object.entries(tiles)) {
          this.onFarmChangedCb?.(mapKey, tileKey, val);
        }
      }
    });
  }

  destroy(): void {
    void this.leaveRoom();
    if (this.enabled) {
      try { off(this.playersRef); } catch (_) {}
    }
  }
}
