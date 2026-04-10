import Phaser from 'phaser';
import { GameTime } from './GameTime';
import { SeededRandom } from '../utils/seedRandom';
import { InvasionHUD } from '../ui/InvasionHUD';

export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  str: number;
  agi: number;
  con: number;
  int: number;
  isDead: boolean;
  sprite: Phaser.GameObjects.Sprite | null;
}

interface InvasionEvent {
  day: number;
  index: number; // 0 또는 1 (하루에 최대 2회)
  count: number; // 적 수 (2~8)
  time: number; // 게임 내 시간 (0~1 사이)
  direction: 'top' | 'bottom' | 'left' | 'right';
  enemies: Array<{
    str: number;
    agi: number;
    con: number;
    int: number;
    weapon: 'fists' | 'sword_wood' | 'sword_stone' | 'bow';
    items: Array<{ itemId: string; count: number }>;
  }>;
  triggered: boolean;
  acknowledged: Set<string>;
}

// 간단한 해시 함수
function hashNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class InvasionSystem {
  private invasionMap = new Map<string, InvasionEvent>();
  private currentInvasion: InvasionEvent | null = null;
  private lastCheckedDay = -1;
  private invasionPanel: HTMLDivElement | null = null;
  private dangerOverlay: Phaser.GameObjects.Rectangle | null = null;
  private dangerText: Phaser.GameObjects.Text | null = null;
  private invasionHUD: InvasionHUD;

  constructor(
    private scene: Phaser.Scene,
    private gameTime: GameTime,
    private seed: string,
    private playerId: string,
  ) {
    this.invasionHUD = new InvasionHUD(scene);
  }

  /** 지정 날짜의 침입 이벤트 생성 */
  private planDay(day: number): InvasionEvent[] {
    const key = `${day}`;
    if (this.invasionMap.has(key)) {
      const evt = this.invasionMap.get(key)!;
      return evt.count > 0 ? [evt] : [];
    }

    const hash = hashNumber(`${this.seed}_invasion_${day}`);

    // 하루 침입 횟수: 0~2 (균등 33%)
    const invasionCountRoll = hash % 3;
    const invasionCount = invasionCountRoll; // 0, 1, 2

    const events: InvasionEvent[] = [];

    for (let idx = 0; idx < invasionCount; idx++) {
      const eventHash = hashNumber(`${this.seed}_invasion_${day}_${idx}`);

      // 침입 시각: 06:00 ~ 22:00 (게임 내 시간)
      const timeRoll = (eventHash >> 8) % 16; // 0~15 (16시간)
      const time = (6 + timeRoll) / 24; // 06:00 ~ 22:00

      // 적 수: 2~8
      const countRoll = (eventHash >> 16) % 7;
      const count = 2 + countRoll;

      // 방향: top, bottom, left, right
      const dirRoll = (eventHash >> 24) % 4;
      const directions: Array<'top' | 'bottom' | 'left' | 'right'> = [
        'top',
        'bottom',
        'left',
        'right',
      ];
      const direction = directions[dirRoll];

      // 적군 생성
      const enemies = [];
      for (let i = 0; i < count; i++) {
        const enemyHash = hashNumber(
          `${this.seed}_enemy_${day}_${idx}_${i}`
        );
        const str = 2 + ((enemyHash >> 0) % 9);
        const agi = 2 + ((enemyHash >> 8) % 9);
        const con = 2 + ((enemyHash >> 16) % 9);
        const int = 2 + ((enemyHash >> 24) % 9);

        // 무기 (가중치: 맨손 30%, 나무칼 35%, 석재칼 20%, 활 15%)
        const weaponRoll = (enemyHash >> 0) % 100;
        let weapon: 'fists' | 'sword_wood' | 'sword_stone' | 'bow';
        if (weaponRoll < 30) weapon = 'fists';
        else if (weaponRoll < 65) weapon = 'sword_wood';
        else if (weaponRoll < 85) weapon = 'sword_stone';
        else weapon = 'bow';

        // 아이템 (0~3개)
        const itemCountRoll = (enemyHash >> 8) % 4;
        const items: Array<{ itemId: string; count: number }> = [];
        for (let j = 0; j < itemCountRoll; j++) {
          const itemHash = hashNumber(
            `${this.seed}_item_${day}_${idx}_${i}_${j}`
          );
          const itemTypes = [
            'item_raw_meat',
            'item_wood',
            'item_stone',
            'item_hide',
            'item_processed_stone',
            'item_tiger_fang',
          ];
          const itemTypeRoll = (itemHash >> 0) % itemTypes.length;
          const itemId = itemTypes[itemTypeRoll];
          const itemCount = 1 + ((itemHash >> 8) % 3);
          items.push({ itemId, count: itemCount });
        }

        enemies.push({ str, agi, con, int, weapon, items });
      }

      events.push({
        day,
        index: idx,
        count,
        time,
        direction,
        enemies,
        triggered: false,
        acknowledged: new Set(),
      });
      this.invasionMap.set(`${day}_${idx}`, events[idx]);
    }

    return events;
  }

  update(delta: number): void {
    const currentDay = this.gameTime.day;

    // 새로운 날이면 그 날의 침입 계획 세우기
    if (currentDay !== this.lastCheckedDay) {
      this.lastCheckedDay = currentDay;
      const events = this.planDay(currentDay);
    }

    // 현재 침입이 없다면, 오늘의 침입 중 발생할 시간이 된 것을 찾기
    if (!this.currentInvasion) {
      const events = this.planDay(currentDay);
      const now = this.gameTime.dayProgress;

      for (const evt of events) {
        // 침입 시간 도달 && 아직 발생하지 않음
        if (Math.abs(now - evt.time) < 0.001 && !evt.triggered) {
          this.triggerInvasion(evt);
          this.currentInvasion = evt;
          break;
        }
      }
    }

    // 침입 진행 중: 패널 업데이트, 타임아웃 체크 등
    if (this.currentInvasion) {
      // TODO: 적군 AI, 위험 이펙트, 패널 업데이트
    }
  }

  private triggerInvasion(event: InvasionEvent): void {
    event.triggered = true;

    // 침입 알림 패널 표시
    this.showInvasionPanel(event);

    // 방향 화살표 + 카운트다운 HUD
    this.invasionHUD.showDirectionArrows(event.direction, event.count);
    this.invasionHUD.showCountdown(event.direction, event.count, 15);

    // 15초 후 자동 재개 (현재는 패널로만 표시)
    this.scene.time.delayedCall(15000, () => {
      this.closeInvasionPanel();
      this.invasionHUD.clearArrows();
    });
  }

  private showInvasionPanel(event: InvasionEvent): void {
    if (this.invasionPanel) this.invasionPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'invasion-panel';
    panel.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 500px; background: rgba(10,15,25,0.98);
      border: 3px solid #cc3333; border-radius: 8px; padding: 20px; z-index: 500;
      color: #fff; font: 12px monospace;
    `;

    const dirLabels: Record<string, string> = {
      top: '북쪽',
      bottom: '남쪽',
      left: '서쪽',
      right: '동쪽',
    };

    const hour = Math.floor(event.time * 24);
    const minute = Math.floor((event.time * 24 * 60) % 60);

    panel.innerHTML = `
      <div style="text-align:center;margin-bottom:15px">
        <div style="font-size:16px;font-weight:bold;color:#ff6666">⚠ 적군 침입!</div>
        <div style="margin-top:10px;font-size:12px;color:#aaa">
          방향: <span style="color:#ffaa00">${dirLabels[event.direction]}</span> |
          규모: <span style="color:#ffaa00">${event.count}명</span>
        </div>
      </div>
      <div id="invasion-players" style="margin:15px 0;padding:10px;background:#1a1a2a;border-radius:4px;max-height:100px;overflow-y:auto"></div>
      <div style="text-align:center;font-size:11px;color:#888;margin:10px 0">
        자동 재개까지: <span id="invasion-timer">15</span>초
      </div>
      <div style="text-align:center">
        <button id="invasion-confirm" style="padding:8px 20px;background:#2a5a2a;color:#aaffaa;border:1px solid #4a7a4a;border-radius:4px;cursor:pointer;font:11px monospace">
          확인 (Enter)
        </button>
      </div>
    `;

    document.body.appendChild(panel);
    this.invasionPanel = panel;

    // 타이머
    let timeLeft = 15;
    const timerInterval = setInterval(() => {
      timeLeft--;
      const timerEl = panel.querySelector('#invasion-timer') as HTMLDivElement;
      if (timerEl) timerEl.textContent = `${timeLeft}`;
      if (timeLeft <= 0) clearInterval(timerInterval);
    }, 1000);

    // 확인 버튼
    panel.querySelector('#invasion-confirm')!.addEventListener('click', () => {
      event.acknowledged.add(this.playerId);
      this.closeInvasionPanel();
    });

    // Enter 키
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        event.acknowledged.add(this.playerId);
        this.closeInvasionPanel();
        document.removeEventListener('keydown', handleEnter);
      }
    };
    document.addEventListener('keydown', handleEnter);
  }

  private closeInvasionPanel(): void {
    this.invasionPanel?.remove();
    this.invasionPanel = null;
  }

  getCurrentInvasion(): InvasionEvent | null {
    return this.currentInvasion;
  }

  endInvasion(): void {
    this.closeDangerUI();
    this.currentInvasion = null;
  }

  showDangerUI(): void {
    if (this.dangerOverlay) return;

    // 빨간 테두리 펄스
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    this.dangerOverlay = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0xff0000, 0.1)
      .setDepth(49)
      .setScrollFactor(0);

    // HUD 텍스트
    this.dangerText = this.scene.add
      .text(W / 2, 20, '⚠ 적군 침입 중', {
        fontSize: '14px',
        color: '#ff4444',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    // 펄스 애니메이션
    if (this.dangerOverlay) {
      this.scene.tweens.add({
        targets: this.dangerOverlay,
        alpha: { start: 0.1, end: 0.3 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
    }

    // 깜빡이는 텍스트
    if (this.dangerText) {
      this.scene.tweens.add({
        targets: this.dangerText,
        alpha: { start: 1, end: 0.5 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  closeDangerUI(): void {
    this.dangerOverlay?.destroy();
    this.dangerText?.destroy();
    this.dangerOverlay = null;
    this.dangerText = null;
  }

  destroy(): void {
    this.closeInvasionPanel();
    this.closeDangerUI();
    this.invasionHUD.destroy();
  }
}
