# Plan 86 — 퀘스트 UI 비주얼

## 목표
퀘스트 추적 패널(화면 우측), 퀘스트 목표 진행 표시줄,
목표 달성 체크 애니메이션, 퀘스트 지도 마커 연동을 구현한다.

## 버전
`v0.86.0`

## 대상 파일
- `src/ui/QuestTrackerPanel.ts` (신규)
- `src/ui/QuestLogPanel.ts` (신규)

---

## 1. 퀘스트 추적 패널 (화면 우측 고정)

```typescript
// src/ui/QuestTrackerPanel.ts

export interface QuestObjective {
  id: string;
  label: string;
  current: number;
  required: number;
  done: boolean;
}

export interface ActiveQuest {
  id: string;
  title: string;
  objectives: QuestObjective[];
  type: 'main' | 'side' | 'daily';
}

const TRACKER = {
  WIDTH:    220,
  BG:       0x0d0d1f,
  BORDER:   0x334466,
  MAIN_CLR: 0xffdd44,
  SIDE_CLR: 0x44aaff,
  DAILY_CLR:0x44ff88,
  FONT:     '"Noto Sans KR", sans-serif',
} as const;

const TYPE_COLORS: Record<ActiveQuest['type'], number> = {
  main:  TRACKER.MAIN_CLR,
  side:  TRACKER.SIDE_CLR,
  daily: TRACKER.DAILY_CLR,
};

export class QuestTrackerPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private questRows: Map<string, Phaser.GameObjects.Container> = new Map();
  private readonly MAX_SHOWN = 3;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0)
      .setDepth(160).setScrollFactor(0);
  }

  setQuests(quests: ActiveQuest[]): void {
    // 기존 제거
    this.questRows.forEach(r => r.destroy());
    this.questRows.clear();
    this.container.removeAll(true);

    const { width: W, height: H } = this.scene.scale;
    let curY = H * 0.35;

    // 최대 MAX_SHOWN개 표시 (메인 퀘스트 우선)
    const sorted = [...quests].sort((a, b) =>
      (a.type === 'main' ? 0 : 1) - (b.type === 'main' ? 0 : 1),
    ).slice(0, this.MAX_SHOWN);

    sorted.forEach((quest, i) => {
      const row = this._buildQuestRow(quest, W, curY);
      this.container.add(row);
      this.questRows.set(quest.id, row);
      curY += this._estimateRowHeight(quest) + 10;
    });
  }

  private _estimateRowHeight(q: ActiveQuest): number {
    return 28 + q.objectives.length * 18;
  }

  private _buildQuestRow(q: ActiveQuest, W: number, y: number): Phaser.GameObjects.Container {
    const rx = W - TRACKER.WIDTH - 8;
    const color = TYPE_COLORS[q.type];

    // 배경
    const height = this._estimateRowHeight(q);
    const bg = this.scene.add.graphics()
      .fillStyle(TRACKER.BG, 0.82)
      .fillRoundedRect(0, 0, TRACKER.WIDTH, height, 5)
      .lineStyle(1, color, 0.4)
      .strokeRoundedRect(0, 0, TRACKER.WIDTH, height, 5);

    // 좌측 컬러 바
    const leftBar = this.scene.add.graphics()
      .fillStyle(color, 0.8)
      .fillRect(0, 0, 3, height);

    // 퀘스트 제목
    const titleTxt = this.scene.add.text(8, 6, q.title, {
      fontSize: '12px', fontFamily: TRACKER.FONT,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
      wordWrap: { width: TRACKER.WIDTH - 16 },
    });

    const children: Phaser.GameObjects.GameObject[] = [bg, leftBar, titleTxt];

    // 목표 목록
    q.objectives.forEach((obj, i) => {
      const oy = 22 + i * 18;
      const isDone = obj.done || obj.current >= obj.required;
      const ratio  = Math.min(1, obj.current / obj.required);

      // 체크/미체크 아이콘
      const checkTxt = this.scene.add.text(8, oy, isDone ? '✓' : '·', {
        fontSize: '11px', fontFamily: 'monospace',
        color: isDone ? '#44ff88' : '#556677',
      });

      // 목표 텍스트
      const objTxt = this.scene.add.text(18, oy, obj.label, {
        fontSize: '10px', fontFamily: TRACKER.FONT,
        color: isDone ? '#667788' : '#aaaaaa',
      });

      // 수량 진행 (required > 1인 경우)
      if (obj.required > 1) {
        const countTxt = this.scene.add.text(TRACKER.WIDTH - 8, oy,
          `${obj.current}/${obj.required}`, {
          fontSize: '10px', fontFamily: 'monospace',
          color: isDone ? '#44ff88' : '#556677',
        }).setOrigin(1, 0);

        // 미니 진행 바
        const progBg = this.scene.add.graphics()
          .fillStyle(0x222233, 1).fillRect(18, oy + 10, TRACKER.WIDTH - 26, 3);
        const progFill = this.scene.add.graphics()
          .fillStyle(isDone ? 0x44ff88 : color, isDone ? 0.6 : 0.8)
          .fillRect(18, oy + 10, (TRACKER.WIDTH - 26) * ratio, 3);

        children.push(countTxt, progBg, progFill);
      }

      children.push(checkTxt, objTxt);
    });

    const row = this.scene.add.container(rx, y, children)
      .setAlpha(0);

    // 슬라이드 인 (오른쪽에서)
    row.setX(rx + 30);
    this.scene.tweens.add({
      targets: row,
      x: rx, alpha: 1,
      duration: 240, ease: 'Cubic.easeOut',
    });

    return row;
  }

  /** 목표 달성 체크 애니메이션 */
  playObjectiveComplete(questId: string, objectiveId: string): void {
    const row = this.questRows.get(questId);
    if (!row) return;

    // 체크 글자 펀치 이펙트
    this.scene.tweens.add({
      targets: row,
      scaleX: 1.04, scaleY: 1.04,
      yoyo: true,
      duration: 120,
    });

    // 녹색 번쩍
    const { width: W } = this.scene.scale;
    const flash = this.scene.add.graphics()
      .fillStyle(0x44ff88, 0.15)
      .fillRoundedRect(W - TRACKER.WIDTH - 8, row.y, TRACKER.WIDTH, 40, 5)
      .setDepth(161).setScrollFactor(0);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  /** 퀘스트 완료 — 해당 행 슬라이드 아웃 */
  playQuestComplete(questId: string): void {
    const row = this.questRows.get(questId);
    if (!row) return;

    this.scene.tweens.add({
      targets: row,
      x: row.x + 40, alpha: 0,
      duration: 300, ease: 'Cubic.easeIn',
      onComplete: () => {
        row.destroy();
        this.questRows.delete(questId);
      },
    });
  }

  destroy(): void {
    this.questRows.forEach(r => r.destroy());
    this.container.destroy();
  }
}
```

---

## 2. 퀘스트 로그 패널 (전체 목록)

```typescript
// src/ui/QuestLogPanel.ts

export interface QuestLogEntry {
  id: string;
  title: string;
  description: string;
  type: ActiveQuest['type'];
  status: 'active' | 'completed' | 'failed';
  objectives: QuestObjective[];
  reward: { gold: number; exp: number; items?: string[] };
}

export class QuestLogPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private selectedId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(quests: QuestLogEntry[]): void {
    this._build(quests);
    this.container.setAlpha(0).setScale(0.95);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 200, ease: 'Back.easeOut',
    });
  }

  private _build(quests: QuestLogEntry[]): void {
    this.container?.destroy();
    const { width: W, height: H } = this.scene.scale;
    const PW = 480, PH = 340;
    const px = (W - PW) / 2, py = (H - PH) / 2;

    const bg = this.scene.add.graphics()
      .fillStyle(0x0d0d1f, 0.97)
      .fillRoundedRect(0, 0, PW, PH, 8)
      .lineStyle(1.5, 0x334466, 1)
      .strokeRoundedRect(0, 0, PW, PH, 8);

    const title = this.scene.add.text(PW / 2, 14, '퀘스트 일지', {
      fontSize: '16px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#aaccff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 탭 (진행 중 / 완료 / 실패)
    const tabs = ['진행 중', '완료', '실패'];
    const tabBtns = tabs.map((t, i) => {
      const tx = 12 + i * 80;
      const tabBg = this.scene.add.graphics()
        .fillStyle(i === 0 ? 0x334466 : 0x111122, 0.9)
        .fillRoundedRect(0, 0, 72, 22, 4)
        .lineStyle(1, i === 0 ? 0x4466aa : 0x223344, 1)
        .strokeRoundedRect(0, 0, 72, 22, 4);
      const tabTxt = this.scene.add.text(36, 11, t, {
        fontSize: '11px', fontFamily: '"Noto Sans KR", sans-serif',
        color: i === 0 ? '#88aaff' : '#445566',
      }).setOrigin(0.5);
      return this.scene.add.container(tx, 34, [tabBg, tabTxt]);
    });

    // 퀘스트 목록 (좌측 패널)
    const listBg = this.scene.add.graphics()
      .fillStyle(0x0a0a18, 0.7).fillRoundedRect(8, 62, 160, PH - 74, 4);

    const listItems = quests
      .filter(q => q.status === 'active')
      .slice(0, 8)
      .map((q, i) => {
        const color = TYPE_COLORS[q.type];
        const itemBg = this.scene.add.graphics()
          .fillStyle(this.selectedId === q.id ? 0x223355 : 0x111122, 0.9)
          .fillRoundedRect(0, 0, 154, 28, 3)
          .lineStyle(1, this.selectedId === q.id ? 0x4466cc : 0x223344, 1)
          .strokeRoundedRect(0, 0, 154, 28, 3);
        const dot = this.scene.add.graphics()
          .fillStyle(color, 0.9).fillCircle(7, 14, 4);
        const qTxt = this.scene.add.text(18, 7, q.title, {
          fontSize: '11px', fontFamily: '"Noto Sans KR", sans-serif',
          color: '#ccccdd',
          wordWrap: { width: 130 },
        });

        itemBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, 154, 28), Phaser.Geom.Rectangle.Contains);
        itemBg.on('pointerdown', () => {
          this.selectedId = q.id;
          this._build(quests);  // 재빌드
        });

        return this.scene.add.container(11, 65 + i * 32, [itemBg, dot, qTxt]);
      });

    // 상세 패널 (우측)
    const selected = quests.find(q => q.id === this.selectedId) ?? quests[0];
    const detailItems: Phaser.GameObjects.GameObject[] = [];

    if (selected) {
      const detailTitle = this.scene.add.text(182, 68, selected.title, {
        fontSize: '14px', fontFamily: '"Noto Sans KR", sans-serif',
        color: Phaser.Display.Color.IntegerToColor(TYPE_COLORS[selected.type]).rgba,
        fontStyle: 'bold', wordWrap: { width: 280 },
      });
      const detailDesc = this.scene.add.text(182, 90, selected.description, {
        fontSize: '11px', fontFamily: '"Noto Sans KR", sans-serif',
        color: '#888899', wordWrap: { width: 280 }, lineSpacing: 2,
      });

      const rewardTxt = this.scene.add.text(182, PH - 60,
        `보상: 💰${selected.reward.gold}G  ✨${selected.reward.exp}EXP`, {
        fontSize: '12px', fontFamily: '"Noto Sans KR", sans-serif',
        color: '#ffcc44',
      });

      detailItems.push(detailTitle, detailDesc, rewardTxt);
    }

    // 닫기 버튼
    const closeBtn = this.scene.add.text(PW - 10, 8, '✕', {
      fontSize: '16px', fontFamily: 'monospace', color: '#667788',
    }).setOrigin(1, 0);
    closeBtn.setInteractive();
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#667788'));

    this.container = this.scene.add.container(px, py, [
      bg, title, ...tabBtns, listBg, ...listItems, ...detailItems, closeBtn,
    ]).setDepth(186).setScrollFactor(0);
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleX: 0.95, scaleY: 0.95,
      duration: 160, ease: 'Cubic.easeIn',
      onComplete: () => this.container?.destroy(),
    });
  }

  destroy(): void { this.container?.destroy(); }
}
```

---

## 3. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 퀘스트 추적 패널    | 160–161 |
| 퀘스트 로그 패널    | 186   |
