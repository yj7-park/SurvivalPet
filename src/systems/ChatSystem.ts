import {
  ref, push, onChildAdded, query, limitToLast, Database,
} from 'firebase/database';

const CHAT_COOLDOWN_MS = 2000;
const MAX_MESSAGES = 50;
const MAX_TEXT_LEN = 60;
const FADE_DELAY_MS = 8000;
const FADE_DURATION_MS = 2000;

const PLAYER_COLORS = [
  '#ff9966', '#66ccff', '#99ff99', '#ffcc66',
  '#cc99ff', '#ff6699', '#66ffcc', '#ffff66',
];

export function getPlayerColor(playerId: string): string {
  let hash = 0;
  for (const ch of playerId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  type: 'user' | 'system';
  timestamp: number;
  color: string;
  alpha: number;
  fadeTimer: number;  // counts down from FADE_DELAY_MS, then fades alpha
}

export class ChatSystem {
  private messages: ChatMessage[] = [];
  private inputActive = false;
  private lastSentAt = 0;
  private disabled = false;
  private db?: Database;
  private seed?: string;

  private onMessageReceivedCb?: (msg: ChatMessage) => void;
  private onInputActiveChangedCb?: (active: boolean) => void;
  private onCooldownWarningCb?: () => void;

  init(seed: string, db: Database): void {
    this.seed = seed;
    this.db = db;
    const chatQuery = query(ref(db, `rooms/${seed}/chat`), limitToLast(MAX_MESSAGES));
    onChildAdded(chatQuery, (snap) => {
      const data = snap.val() as Omit<ChatMessage, 'id' | 'alpha' | 'fadeTimer'>;
      const msg: ChatMessage = {
        ...data,
        id: snap.key!,
        alpha: 1.0,
        fadeTimer: FADE_DELAY_MS,
      };
      this.messages.push(msg);
      if (this.messages.length > MAX_MESSAGES) this.messages.shift();
      this.onMessageReceivedCb?.(msg);
    });
  }

  disable(): void { this.disabled = true; }
  isDisabled(): boolean { return this.disabled; }

  isInputActive(): boolean { return this.inputActive; }

  openInput(): void {
    if (this.disabled) return;
    this.inputActive = true;
    // Reset all fade when chat opens
    for (const m of this.messages) { m.alpha = 1.0; m.fadeTimer = FADE_DELAY_MS; }
    this.onInputActiveChangedCb?.(true);
  }

  closeInput(): void {
    this.inputActive = false;
    this.onInputActiveChangedCb?.(false);
  }

  /** Returns false if on cooldown */
  send(text: string, playerId: string, playerName: string): boolean {
    if (this.disabled || !this.db || !this.seed) return false;
    if (text.trim().length === 0) return false;
    const now = Date.now();
    if (now - this.lastSentAt < CHAT_COOLDOWN_MS) {
      this.onCooldownWarningCb?.();
      return false;
    }
    this.lastSentAt = now;
    const color = getPlayerColor(playerId);
    push(ref(this.db, `rooms/${this.seed}/chat`), {
      playerId,
      playerName,
      text: text.substring(0, MAX_TEXT_LEN),
      type: 'user',
      timestamp: now,
      color,
    });
    return true;
  }

  sendSystemMessage(text: string): void {
    if (this.disabled || !this.db || !this.seed) return;
    push(ref(this.db, `rooms/${this.seed}/chat`), {
      playerId: 'system',
      playerName: 'system',
      text,
      type: 'system',
      timestamp: Date.now(),
      color: '#aaaaaa',
    });
  }

  onMessageReceived(cb: (msg: ChatMessage) => void): void { this.onMessageReceivedCb = cb; }
  onInputActiveChanged(cb: (active: boolean) => void): void { this.onInputActiveChangedCb = cb; }
  onCooldownWarning(cb: () => void): void { this.onCooldownWarningCb = cb; }

  getMessages(): ChatMessage[] { return this.messages; }

  pauseFade(): void {
    for (const m of this.messages) {
      if (m.fadeTimer <= 0 && m.alpha < 1.0) {
        m.fadeTimer = 1; // keep from fading further
      }
    }
  }

  resumeFade(): void { /* fade timers continue normally */ }

  update(delta: number): void {
    if (this.disabled || this.inputActive) return;
    for (const m of this.messages) {
      if (m.alpha <= 0) continue;
      if (m.fadeTimer > 0) {
        m.fadeTimer -= delta;
      } else {
        m.alpha = Math.max(0, m.alpha - delta / FADE_DURATION_MS);
      }
    }
  }
}
