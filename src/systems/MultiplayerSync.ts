import { ref, set, onValue, onDisconnect, off, Database } from 'firebase/database';
import { initFirebase, isFirebaseConfigured } from '../config/firebase';

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  mapX: number;
  mapY: number;
  dir: string;
  hp: number;
  lastSeen: number;
}

type PlayersCallback = (players: RemotePlayer[]) => void;

export class MultiplayerSync {
  private enabled = false;
  private db!: Database;
  private lastWrite = 0;
  private onPlayersCallback?: PlayersCallback;

  constructor(private seed: string, private playerId: string) {
    if (!isFirebaseConfigured()) return;
    try {
      this.db = initFirebase();
      const myRef = ref(this.db, `rooms/${seed}/players/${playerId}`);
      onDisconnect(myRef).remove();

      onValue(ref(this.db, `rooms/${seed}/players`), (snap) => {
        const data = snap.val();
        if (!data) { this.onPlayersCallback?.([]); return; }
        const now = Date.now();
        const players: RemotePlayer[] = Object.entries(data as Record<string, RemotePlayer>)
          .filter(([id, p]) => id !== playerId && now - p.lastSeen < 5000)
          .map(([id, p]) => ({ ...p, id }));
        this.onPlayersCallback?.(players);
      });

      this.enabled = true;
    } catch (e) {
      console.warn('Multiplayer disabled:', e);
    }
  }

  onPlayersUpdate(cb: PlayersCallback) { this.onPlayersCallback = cb; }

  sync(now: number, x: number, y: number, mapX: number, mapY: number, dir: string, hp: number) {
    if (!this.enabled || now - this.lastWrite < 100) return;
    this.lastWrite = now;
    set(ref(this.db, `rooms/${this.seed}/players/${this.playerId}`),
      { x, y, mapX, mapY, dir, hp, lastSeen: Date.now() });
  }

  destroy() {
    if (!this.enabled) return;
    try { off(ref(this.db, `rooms/${this.seed}/players`)); } catch (_) {}
  }
}
