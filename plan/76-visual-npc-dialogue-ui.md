# Plan 76 — NPC 대화·상호작용 UI 비주얼

## 목표
NPC 대화창, 말풍선, 상호작용 프롬프트, 퀘스트 수락/완료 연출 등
플레이어가 NPC와 상호작용할 때 보이는 모든 시각 요소를 구현한다.

## 버전
`v0.76.0`

## 대상 파일
- `src/ui/DialogueBox.ts` (신규)
- `src/ui/NPCSpeechBubble.ts` (신규)
- `src/ui/InteractionPrompt.ts` (신규)
- `src/ui/QuestNotification.ts` (신규)

---

## 1. 대화창 (DialogueBox)

### 1-1. 레이아웃 상수

```typescript
// src/ui/DialogueBox.ts

const DB = {
  WIDTH:      520,
  HEIGHT:     110,
  PADDING:    16,
  CORNER:     8,
  BG_COLOR:   0x1a1a2e,
  BG_ALPHA:   0.92,
  BORDER_CLR: 0x4488cc,
  BORDER_W:   2,
  NAME_CLR:   '#88ccff',
  TEXT_CLR:   '#e8e8e8',
  FONT:       '"Noto Sans KR", sans-serif',
  ARROW_CLR:  0x88ccff,
} as const;
```

### 1-2. DialogueBox 클래스

```typescript
export class DialogueBox {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Graphics;   // 다음 페이지 ▼
  private portrait!: Phaser.GameObjects.Graphics; // NPC 초상화
  private typeTimer: Phaser.Time.TimerEvent | null = null;
  private currentFull = '';
  private typeIndex  = 0;
  private onFinish?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._build();
  }

  private _build(): void {
    const { width: W, height: H } = this.scene.scale;
    const x = (W - DB.WIDTH) / 2;
    const y = H - DB.HEIGHT - 20;

    // 배경 패널
    this.bg = this.scene.add.graphics()
      .lineStyle(DB.BORDER_W, DB.BORDER_CLR, 1)
      .fillStyle(DB.BG_COLOR, DB.BG_ALPHA)
      .fillRoundedRect(0, 0, DB.WIDTH, DB.HEIGHT, DB.CORNER)
      .strokeRoundedRect(0, 0, DB.WIDTH, DB.HEIGHT, DB.CORNER);

    // NPC 초상화 영역 (48×48, 왼쪽)
    this.portrait = this.scene.add.graphics()
      .fillStyle(0x223355, 1)
      .fillRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4)
      .lineStyle(1, DB.BORDER_CLR, 0.6)
      .strokeRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4);

    // 이름 텍스트
    this.nameText = this.scene.add.text(
      DB.PADDING + 56, DB.PADDING,
      '',
      { fontSize: '13px', fontFamily: DB.FONT, color: DB.NAME_CLR, fontStyle: 'bold' },
    );

    // 본문 텍스트 (타이핑 대상)
    this.bodyText = this.scene.add.text(
      DB.PADDING + 56, DB.PADDING + 20,
      '',
      {
        fontSize: '13px',
        fontFamily: DB.FONT,
        color: DB.TEXT_CLR,
        wordWrap: { width: DB.WIDTH - DB.PADDING * 2 - 64 },
        lineSpacing: 4,
      },
    );

    // 다음 페이지 화살표 ▼ (깜빡임)
    this.arrow = this.scene.add.graphics();
    this._drawArrow(1);
    this.scene.tweens.add({
      targets: this.arrow,
      alpha: 0.2,
      yoyo: true,
      repeat: -1,
      duration: 500,
    });

    this.container = this.scene.add.container(x, y, [
      this.bg, this.portrait, this.nameText, this.bodyText, this.arrow,
    ]).setDepth(180).setScrollFactor(0).setAlpha(0);
  }

  private _drawArrow(alpha: number): void {
    this.arrow.clear().fillStyle(DB.ARROW_CLR, alpha);
    const ax = DB.WIDTH - DB.PADDING - 8;
    const ay = DB.HEIGHT - DB.PADDING - 4;
    this.arrow.fillTriangle(ax, ay, ax - 6, ay - 8, ax + 6, ay - 8);
  }

  /** NPC 초상화 픽셀아트 드로우 (16색 팔레트 기반) */
  setPortrait(npcType: 'merchant' | 'guard' | 'elder' | 'villager'): void {
    this.portrait.clear()
      .fillStyle(0x223355, 1)
      .fillRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4)
      .lineStyle(1, DB.BORDER_CLR, 0.6)
      .strokeRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4);

    const colors: Record<typeof npcType, { skin: number; hair: number; cloth: number }> = {
      merchant: { skin: 0xddb58a, hair: 0x7a4f2a, cloth: 0x8855cc },
      guard:    { skin: 0xcc9966, hair: 0x444444, cloth: 0x4466aa },
      elder:    { skin: 0xe8c8a0, hair: 0xdddddd, cloth: 0x668855 },
      villager: { skin: 0xddb58a, hair: 0x996633, cloth: 0xaa6633 },
    };
    const c = colors[npcType];
    const ox = DB.PADDING + 8, oy = DB.PADDING + 6, S = 3;

    // 머리
    this.portrait.fillStyle(c.skin, 1)
      .fillRect(ox + S * 3, oy,       S * 4, S * 5);
    // 머리카락
    this.portrait.fillStyle(c.hair, 1)
      .fillRect(ox + S * 2, oy,       S * 6, S * 2)
      .fillRect(ox + S * 2, oy + S * 2, S,    S * 3);
    // 눈
    this.portrait.fillStyle(0x222222, 1)
      .fillRect(ox + S * 4, oy + S * 2, S, S)
      .fillRect(ox + S * 6, oy + S * 2, S, S);
    // 몸통
    this.portrait.fillStyle(c.cloth, 1)
      .fillRect(ox + S * 2, oy + S * 5, S * 6, S * 5);
  }

  /** 대화창 표시 + 타이핑 애니메이션 */
  show(npcName: string, text: string, onFinish?: () => void): void {
    this.onFinish = onFinish;
    this.currentFull = text;
    this.typeIndex = 0;
    this.bodyText.setText('');
    this.nameText.setText(npcName);
    this.arrow.setAlpha(0);

    // 슬라이드 업 + 페이드 인
    this.container.setAlpha(0).setY(this.container.y + 12);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: this.container.y - 12,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => this._startTyping(),
    });
  }

  private _startTyping(): void {
    this.typeTimer?.remove();
    this.typeTimer = this.scene.time.addEvent({
      delay: 28,
      repeat: this.currentFull.length - 1,
      callback: () => {
        this.typeIndex++;
        this.bodyText.setText(this.currentFull.slice(0, this.typeIndex));
        if (this.typeIndex >= this.currentFull.length) {
          this.arrow.setAlpha(1);
          this.onFinish?.();
        }
      },
    });
  }

  /** 클릭·스페이스 입력 시 전체 텍스트 즉시 표시 */
  skipTyping(): void {
    if (this.typeIndex < this.currentFull.length) {
      this.typeTimer?.remove();
      this.bodyText.setText(this.currentFull);
      this.typeIndex = this.currentFull.length;
      this.arrow.setAlpha(1);
      this.onFinish?.();
    }
  }

  hide(onComplete?: () => void): void {
    this.typeTimer?.remove();
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.container.y + 10,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete,
    });
  }

  destroy(): void {
    this.typeTimer?.remove();
    this.container.destroy();
  }
}
```

---

## 2. NPC 말풍선 (NPCSpeechBubble)

```typescript
// src/ui/NPCSpeechBubble.ts

export class NPCSpeechBubble {
  private scene: Phaser.Scene;
  /** npcId → { container, tween } */
  private bubbles: Map<string, {
    container: Phaser.GameObjects.Container;
    tween: Phaser.Tweens.Tween;
  }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 짧은 대사·감탄사용 말풍선 (자동 소멸) */
  showQuick(
    npcId: string,
    worldX: number,
    worldY: number,
    text: string,
    duration = 2400,
  ): void {
    // 이미 있으면 교체
    this.hide(npcId);

    const txt = this.scene.add.text(0, 0, text, {
      fontSize: '12px',
      fontFamily: '"Noto Sans KR", sans-serif',
      color: '#ffffff',
      padding: { x: 8, y: 5 },
    });
    const W = txt.width + 16, H = txt.height + 10;
    txt.setPosition(-W / 2 + 8, -H / 2 + 5);

    // 배경 둥근 사각형
    const bg = this.scene.add.graphics()
      .fillStyle(0x1a1a2e, 0.88)
      .fillRoundedRect(-W / 2, -H / 2, W, H, 6)
      .lineStyle(1.5, 0x88aacc, 0.9)
      .strokeRoundedRect(-W / 2, -H / 2, W, H, 6);

    // 꼬리 삼각형 (아래 방향)
    const tail = this.scene.add.graphics()
      .fillStyle(0x1a1a2e, 0.88)
      .fillTriangle(-5, H / 2, 5, H / 2, 0, H / 2 + 7);

    const container = this.scene.add.container(worldX, worldY - 32, [bg, tail, txt])
      .setDepth(90)
      .setAlpha(0);

    // 팝업 애니메이션
    const tween = this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scaleY: { from: 0.3, to: 1 },
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 유지 후 페이드 아웃
        this.scene.time.delayedCall(duration, () => {
          this.scene.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 8,
            duration: 300,
            onComplete: () => {
              container.destroy();
              this.bubbles.delete(npcId);
            },
          });
        });
      },
    });

    this.bubbles.set(npcId, { container, tween });
  }

  /** NPC 위치 추적 업데이트 */
  updatePosition(npcId: string, worldX: number, worldY: number): void {
    const entry = this.bubbles.get(npcId);
    if (entry) {
      entry.container.setPosition(worldX, worldY - 32);
    }
  }

  hide(npcId: string): void {
    const entry = this.bubbles.get(npcId);
    if (!entry) return;
    entry.tween.stop();
    entry.container.destroy();
    this.bubbles.delete(npcId);
  }

  hideAll(): void {
    for (const [id] of this.bubbles) this.hide(id);
  }

  destroy(): void {
    this.hideAll();
  }
}
```

---

## 3. 상호작용 프롬프트 (InteractionPrompt)

```typescript
// src/ui/InteractionPrompt.ts

/** [F] 상호작용  /  [E] 공격  등 근처 대상 힌트 UI */
export class InteractionPrompt {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private keyLabel!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private bobTween!: Phaser.Tweens.Tween;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._build();
  }

  private _build(): void {
    // 키 배지 ([F])
    const keyBg = this.scene.add.graphics()
      .fillStyle(0x333355, 0.9)
      .fillRoundedRect(0, 0, 22, 18, 4)
      .lineStyle(1.5, 0x8888cc, 1)
      .strokeRoundedRect(0, 0, 22, 18, 4);

    this.keyLabel = this.scene.add.text(11, 9, 'F', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ccccff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.descText = this.scene.add.text(28, 1, '', {
      fontSize: '12px',
      fontFamily: '"Noto Sans KR", sans-serif',
      color: '#dddddd',
    });

    this.container = this.scene.add.container(0, 0, [keyBg, this.keyLabel, this.descText])
      .setDepth(95)
      .setScrollFactor(0)
      .setAlpha(0);

    // 위아래 부유 애니메이션
    this.bobTween = this.scene.tweens.add({
      targets: this.container,
      y: '+=4',
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.easeInOut',
      paused: true,
    });
  }

  show(
    worldX: number,
    worldY: number,
    key: string,
    desc: string,
  ): void {
    if (this.visible) return;
    this.visible = true;
    this.keyLabel.setText(key);
    this.descText.setText(desc);

    const cam = this.scene.cameras.main;
    const sx = (worldX - cam.scrollX) - this.container.width / 2;
    const sy = (worldY - cam.scrollY) - 40;
    this.container.setPosition(sx, sy);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 180,
      ease: 'Linear',
    });
    this.bobTween.resume();
  }

  updatePosition(worldX: number, worldY: number): void {
    if (!this.visible) return;
    const cam = this.scene.cameras.main;
    this.container.setPosition(
      (worldX - cam.scrollX) - this.container.width / 2,
      (worldY - cam.scrollY) - 40 + (this.container.y % 4),
    );
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.bobTween.pause();
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 120,
      ease: 'Linear',
    });
  }

  destroy(): void {
    this.bobTween.stop();
    this.container.destroy();
  }
}
```

---

## 4. 퀘스트 수락·완료 알림 (QuestNotification)

```typescript
// src/ui/QuestNotification.ts

export type QuestEventType = 'accept' | 'complete' | 'fail' | 'update';

const QUEST_COLORS: Record<QuestEventType, number> = {
  accept:   0x44aaff,
  complete: 0xffdd44,
  fail:     0xff4444,
  update:   0x88cc88,
};

const QUEST_ICONS: Record<QuestEventType, string> = {
  accept:   '!',
  complete: '★',
  fail:     '✕',
  update:   '↑',
};

export class QuestNotification {
  private scene: Phaser.Scene;
  private queue: Array<{ type: QuestEventType; title: string; desc: string }> = [];
  private showing = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  push(type: QuestEventType, title: string, desc: string): void {
    this.queue.push({ type, title, desc });
    if (!this.showing) this._next();
  }

  private _next(): void {
    if (this.queue.length === 0) { this.showing = false; return; }
    this.showing = true;
    const { type, title, desc } = this.queue.shift()!;
    this._show(type, title, desc);
  }

  private _show(type: QuestEventType, title: string, desc: string): void {
    const { width: W } = this.scene.scale;
    const color  = QUEST_COLORS[type];
    const icon   = QUEST_ICONS[type];
    const PANEL_W = 260, PANEL_H = 56;
    const startX  = W + PANEL_W / 2;
    const finalX  = W - PANEL_W / 2 - 16;
    const Y       = 60;

    // 아이콘 배지
    const badge = this.scene.add.graphics()
      .fillStyle(color, 1)
      .fillCircle(0, 0, 14);
    const iconTxt = this.scene.add.text(0, 0, icon, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 패널 배경
    const bg = this.scene.add.graphics()
      .fillStyle(0x111122, 0.92)
      .fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 6)
      .lineStyle(1.5, color, 0.8)
      .strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 6);

    // 제목·설명
    const titleTxt = this.scene.add.text(-PANEL_W / 2 + 24, -16, title, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
    });
    const descTxt = this.scene.add.text(-PANEL_W / 2 + 24, 2, desc, {
      fontSize: '11px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#aaaaaa',
    });

    const container = this.scene.add.container(startX, Y, [bg, badge, iconTxt, titleTxt, descTxt])
      .setDepth(190)
      .setScrollFactor(0);

    // 슬라이드 인
    this.scene.tweens.add({
      targets: container,
      x: finalX,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 2초 유지 후 슬라이드 아웃
        this.scene.time.delayedCall(2000, () => {
          this.scene.tweens.add({
            targets: container,
            x: startX,
            duration: 260,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              container.destroy();
              this._next();
            },
          });
        });
      },
    });

    // 퀘스트 완료 시 골드 파티클 추가
    if (type === 'complete') {
      this._playCompleteSparkle(finalX, Y);
    }
  }

  private _playCompleteSparkle(cx: number, cy: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const star = this.scene.add.graphics()
        .fillStyle(0xffdd44, 1)
        .fillStar(0, 0, 4, 3, 4)   // Phaser.Geom.Star 근사
        .setDepth(191)
        .setScrollFactor(0)
        .setPosition(cx, cy);

      this.scene.tweens.add({
        targets: star,
        x: cx + Math.cos(angle) * 36,
        y: cy + Math.sin(angle) * 36,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 500,
        delay: i * 30,
        ease: 'Sine.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  destroy(): void {
    this.queue.length = 0;
  }
}
```

---

## 5. 대화 선택지 UI (DialogueChoice)

```typescript
// src/ui/DialogueBox.ts (추가 클래스)

export interface ChoiceOption {
  label: string;
  action: () => void;
  disabled?: boolean;
}

export class DialogueChoice {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private items: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(options: ChoiceOption[], anchorY: number): void {
    this.hide();
    const { width: W } = this.scene.scale;
    const ITEM_H = 30, ITEM_W = 300, GAP = 4;
    const totalH = options.length * (ITEM_H + GAP);
    const startY = anchorY - totalH - 12;

    this.items = options.map((opt, i) => {
      const bg = this.scene.add.graphics();
      const isDisabled = opt.disabled ?? false;
      const bgColor  = isDisabled ? 0x222233 : 0x1a1a2e;
      const txtColor = isDisabled ? '#666677' : '#ddddff';
      const borderC  = isDisabled ? 0x444455 : 0x4466aa;

      bg.fillStyle(bgColor, 0.9)
        .fillRoundedRect(0, 0, ITEM_W, ITEM_H, 5)
        .lineStyle(1, borderC, 0.8)
        .strokeRoundedRect(0, 0, ITEM_W, ITEM_H, 5);

      const txt = this.scene.add.text(12, ITEM_H / 2, `▶  ${opt.label}`, {
        fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
        color: txtColor,
      }).setOrigin(0, 0.5);

      const item = this.scene.add.container(
        W / 2 - ITEM_W / 2,
        startY + i * (ITEM_H + GAP),
        [bg, txt],
      ).setDepth(182).setScrollFactor(0).setAlpha(0);

      if (!isDisabled) {
        // 호버 효과
        bg.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, ITEM_W, ITEM_H),
          Phaser.Geom.Rectangle.Contains,
        );
        bg.on('pointerover', () => {
          bg.clear()
            .fillStyle(0x2a2a4e, 0.95)
            .fillRoundedRect(0, 0, ITEM_W, ITEM_H, 5)
            .lineStyle(1.5, 0x88aaff, 1)
            .strokeRoundedRect(0, 0, ITEM_W, ITEM_H, 5);
          txt.setColor('#ffffff');
          this.scene.tweens.add({ targets: item, scaleX: 1.02, scaleY: 1.02, duration: 80 });
        });
        bg.on('pointerout', () => {
          bg.clear()
            .fillStyle(bgColor, 0.9)
            .fillRoundedRect(0, 0, ITEM_W, ITEM_H, 5)
            .lineStyle(1, borderC, 0.8)
            .strokeRoundedRect(0, 0, ITEM_W, ITEM_H, 5);
          txt.setColor(txtColor);
          this.scene.tweens.add({ targets: item, scaleX: 1, scaleY: 1, duration: 80 });
        });
        bg.on('pointerdown', () => {
          this.hide();
          opt.action();
        });
      }

      // 슬라이드 인 (순서대로)
      this.scene.tweens.add({
        targets: item,
        alpha: 1,
        x: item.x,
        duration: 160,
        delay: i * 55,
        ease: 'Cubic.easeOut',
      });
      // 왼쪽에서 시작
      item.x -= 20;
      this.scene.tweens.add({
        targets: item,
        x: item.x + 20,
        duration: 160,
        delay: i * 55,
        ease: 'Cubic.easeOut',
      });

      return item;
    });

    this.container = this.scene.add.container(0, 0, this.items).setScrollFactor(0);
  }

  hide(): void {
    this.items.forEach(item => {
      this.scene.tweens.add({
        targets: item,
        alpha: 0,
        duration: 100,
        onComplete: () => item.destroy(),
      });
    });
    this.items = [];
    this.container?.destroy();
  }

  destroy(): void {
    this.hide();
  }
}
```

---

## 6. NPC 머리 위 상태 아이콘

```typescript
// src/ui/NPCSpeechBubble.ts (추가)

export type NPCStateIcon = 'quest_new' | 'quest_done' | 'shop' | 'talk' | 'busy';

const STATE_COLORS: Record<NPCStateIcon, number> = {
  quest_new:  0xffdd00,
  quest_done: 0x44ff88,
  shop:       0xffaa44,
  talk:       0x88ccff,
  busy:       0x888888,
};
const STATE_SYMBOLS: Record<NPCStateIcon, string> = {
  quest_new:  '!',
  quest_done: '?',
  shop:       '$',
  talk:       '…',
  busy:       '✕',
};

export class NPCStateIndicator {
  private scene: Phaser.Scene;
  private indicators: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  set(npcId: string, worldX: number, worldY: number, state: NPCStateIcon): void {
    this.indicators.get(npcId)?.destroy();

    const color = STATE_COLORS[state];
    const sym   = STATE_SYMBOLS[state];

    const bg = this.scene.add.graphics()
      .fillStyle(color, 1)
      .fillCircle(0, 0, 9)
      .lineStyle(1.5, 0x000000, 0.5)
      .strokeCircle(0, 0, 9);

    const txt = this.scene.add.text(0, 0, sym, {
      fontSize: '11px', fontFamily: 'monospace',
      color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.scene.add.container(worldX, worldY - 26, [bg, txt])
      .setDepth(88);

    // 팝인 + 영구 부유
    container.setScale(0);
    this.scene.tweens.add({
      targets: container, scaleX: 1, scaleY: 1,
      duration: 200, ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: container,
      y: worldY - 26 - 4,
      yoyo: true, repeat: -1,
      duration: 800, ease: 'Sine.easeInOut',
    });

    this.indicators.set(npcId, container);
  }

  updatePosition(npcId: string, worldX: number, worldY: number): void {
    const c = this.indicators.get(npcId);
    if (c) c.setPosition(worldX, worldY - 26);
  }

  clear(npcId: string): void {
    this.indicators.get(npcId)?.destroy();
    this.indicators.delete(npcId);
  }

  destroy(): void {
    for (const [id] of this.indicators) this.clear(id);
  }
}
```

---

## 7. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| NPC 상태 아이콘      | 88    |
| 말풍선              | 90    |
| 상호작용 프롬프트    | 95    |
| 대화창              | 180   |
| 선택지 패널          | 182   |
| 퀘스트 알림          | 190–191 |

---

## 8. 사용 예시

```typescript
// GameScene.ts / UIScene.ts 초기화
const dialogue    = new DialogueBox(this);
const speechBubble= new NPCSpeechBubble(this);
const prompt      = new InteractionPrompt(this);
const questNotif  = new QuestNotification(this);
const npcState    = new NPCStateIndicator(this);
const choice      = new DialogueChoice(this);

// NPC 접근 시
prompt.show(npc.x, npc.y, 'F', '대화하기');

// 대화 시작
dialogue.setPortrait('merchant');
dialogue.show('상인 클라우드', '어서오세요! 무엇이 필요하신가요?', () => {
  choice.show([
    { label: '물건 사기',   action: () => openShop() },
    { label: '퀘스트 수락', action: () => acceptQuest() },
    { label: '떠나기',      action: () => dialogue.hide() },
  ], dialogue_y);
});

// 퀘스트 완료
questNotif.push('complete', '퀘스트 완료!', '보물 상자를 열었다');

// NPC 상태 표시
npcState.set('npc_001', 120, 80, 'quest_new');
```
