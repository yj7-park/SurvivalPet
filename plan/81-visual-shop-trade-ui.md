# Plan 81 — 상점·거래 UI 비주얼

## 목표
NPC 상점 패널, 구매/판매 슬롯, 가격 표시, 골드 잔액 애니메이션,
거래 확인 이펙트 등 상점 관련 모든 시각 요소를 구현한다.

## 버전
`v0.81.0`

## 대상 파일
- `src/ui/ShopPanel.ts` (신규)
- `src/ui/TradeConfirmDialog.ts` (신규)
- `src/rendering/GoldCoinFX.ts` (신규)

---

## 1. 상점 패널 레이아웃 상수

```typescript
// src/ui/ShopPanel.ts

const SHOP = {
  WIDTH:       480,
  HEIGHT:      380,
  PADDING:     14,
  SLOT_SIZE:   52,
  SLOT_COLS:   5,
  BG:          0x0d0d1f,
  PANEL_BG:    0x141428,
  BORDER:      0x4455aa,
  HEADER_H:    44,
  TAB_W:       90,
  GOLD_COLOR:  '#ffcc44',
  FONT:        '"Noto Sans KR", sans-serif',
} as const;

type ShopTab = 'buy' | 'sell' | 'repair';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;        // 이모지 또는 단일 문자
  price: number;
  grade: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stock: number | 'unlimited';
  description: string;
}
```

---

## 2. ShopPanel 클래스

```typescript
export class ShopPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private tabBtns: Phaser.GameObjects.Container[] = [];
  private itemSlots: Phaser.GameObjects.Container[] = [];
  private goldText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private activeTab: ShopTab = 'buy';
  private items: ShopItem[] = [];
  private selectedIndex = -1;
  private onBuy?: (item: ShopItem) => void;
  private onSell?: (item: ShopItem) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._build();
  }

  private _build(): void {
    const { width: W, height: H } = this.scene.scale;
    const px = (W - SHOP.WIDTH) / 2;
    const py = (H - SHOP.HEIGHT) / 2;

    // ── 배경 패널 ──────────────────────────────────────────
    const bg = this.scene.add.graphics()
      .fillStyle(SHOP.BG, 0.97)
      .fillRoundedRect(0, 0, SHOP.WIDTH, SHOP.HEIGHT, 8)
      .lineStyle(2, SHOP.BORDER, 1)
      .strokeRoundedRect(0, 0, SHOP.WIDTH, SHOP.HEIGHT, 8);

    // 헤더 바
    const header = this.scene.add.graphics()
      .fillStyle(SHOP.PANEL_BG, 1)
      .fillRoundedRect(0, 0, SHOP.WIDTH, SHOP.HEADER_H, { tl: 8, tr: 8, bl: 0, br: 0 })
      .lineStyle(1, SHOP.BORDER, 0.5)
      .strokeLineShape(new Phaser.Geom.Line(0, SHOP.HEADER_H, SHOP.WIDTH, SHOP.HEADER_H));

    // 상점 제목
    const titleTxt = this.scene.add.text(SHOP.PADDING, 12, '🏪  상점', {
      fontSize: '16px', fontFamily: SHOP.FONT,
      color: '#aaccff', fontStyle: 'bold',
    });

    // 골드 잔액 표시 (우상단)
    this.goldText = this.scene.add.text(SHOP.WIDTH - SHOP.PADDING, 12, '💰 0G', {
      fontSize: '14px', fontFamily: SHOP.FONT,
      color: SHOP.GOLD_COLOR, fontStyle: 'bold',
    }).setOrigin(1, 0);

    // 닫기 버튼
    const closeBtn = this._makeCloseBtn();

    // ── 탭 버튼 ───────────────────────────────────────────
    const tabs: { key: ShopTab; label: string }[] = [
      { key: 'buy',    label: '구매' },
      { key: 'sell',   label: '판매' },
      { key: 'repair', label: '수리' },
    ];
    this.tabBtns = tabs.map((t, i) => this._makeTab(t.key, t.label, i));

    // ── 아이템 그리드 영역 ─────────────────────────────────
    const gridBg = this.scene.add.graphics()
      .fillStyle(SHOP.PANEL_BG, 0.8)
      .fillRoundedRect(SHOP.PADDING, SHOP.HEADER_H + 36, SHOP.WIDTH - SHOP.PADDING * 2, 180, 4);

    // ── 설명 영역 ──────────────────────────────────────────
    this.descText = this.scene.add.text(
      SHOP.PADDING, SHOP.HEADER_H + 224, '',
      { fontSize: '11px', fontFamily: SHOP.FONT, color: '#aaaaaa', wordWrap: { width: SHOP.WIDTH - SHOP.PADDING * 2 } },
    );

    // ── 구매 버튼 ──────────────────────────────────────────
    const buyBtn = this._makeActionBtn(
      SHOP.WIDTH - SHOP.PADDING - 100,
      SHOP.HEIGHT - 40,
      '구매하기', 0x2255aa,
      () => this._handleAction(),
    );

    this.container = this.scene.add.container(px, py, [
      bg, header, titleTxt, this.goldText, closeBtn,
      ...this.tabBtns, gridBg, this.descText, buyBtn,
    ]).setDepth(185).setScrollFactor(0).setAlpha(0);
  }

  private _makeTab(key: ShopTab, label: string, index: number): Phaser.GameObjects.Container {
    const x = SHOP.PADDING + index * (SHOP.TAB_W + 4);
    const y = SHOP.HEADER_H + 4;
    const isActive = key === this.activeTab;

    const bg = this.scene.add.graphics()
      .fillStyle(isActive ? SHOP.BORDER : 0x222233, isActive ? 0.9 : 0.7)
      .fillRoundedRect(0, 0, SHOP.TAB_W, 28, 4)
      .lineStyle(1, isActive ? 0x88aaff : 0x334455, 1)
      .strokeRoundedRect(0, 0, SHOP.TAB_W, 28, 4);

    const txt = this.scene.add.text(SHOP.TAB_W / 2, 14, label, {
      fontSize: '12px', fontFamily: SHOP.FONT,
      color: isActive ? '#ffffff' : '#778899',
    }).setOrigin(0.5);

    const container = this.scene.add.container(x, y, [bg, txt]);

    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, SHOP.TAB_W, 28), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => this.switchTab(key));
    bg.on('pointerover', () => { if (key !== this.activeTab) bg.setAlpha(0.9); });
    bg.on('pointerout',  () => { if (key !== this.activeTab) bg.setAlpha(1); });

    return container;
  }

  private _makeCloseBtn(): Phaser.GameObjects.Text {
    const btn = this.scene.add.text(SHOP.WIDTH - 10, 8, '✕', {
      fontSize: '16px', fontFamily: 'monospace', color: '#667788',
    }).setOrigin(1, 0);
    btn.setInteractive();
    btn.on('pointerdown', () => this.hide());
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#667788'));
    return btn;
  }

  private _makeActionBtn(
    x: number, y: number, label: string, color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const W = 100, H = 30;
    const bg = this.scene.add.graphics()
      .fillStyle(color, 0.9)
      .fillRoundedRect(0, 0, W, H, 5)
      .lineStyle(1, color + 0x222222, 1)
      .strokeRoundedRect(0, 0, W, H, 5);
    const txt = this.scene.add.text(W / 2, H / 2, label, {
      fontSize: '13px', fontFamily: SHOP.FONT, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', onClick);
    bg.on('pointerover', () => this.scene.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 60 }));
    bg.on('pointerout',  () => this.scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 60 }));

    const container = this.scene.add.container(x, y, [bg, txt]);
    return container;
  }

  // ── 공개 API ─────────────────────────────────────────────

  setItems(items: ShopItem[]): void {
    this.items = items;
    this._refreshGrid();
  }

  setGold(amount: number): void {
    const prev = parseInt(this.goldText.text.replace(/[^0-9]/g, '') || '0');
    // 골드 증감 애니메이션
    if (amount !== prev) {
      this.scene.tweens.addCounter({
        from: prev, to: amount,
        duration: 400,
        ease: 'Cubic.easeOut',
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          this.goldText.setText(`💰 ${Math.round(tween.getValue())}G`);
        },
      });
    }
  }

  switchTab(tab: ShopTab): void {
    this.activeTab = tab;
    this.selectedIndex = -1;
    this._refreshGrid();
    this._refreshTabs();
  }

  show(onBuy?: (item: ShopItem) => void, onSell?: (item: ShopItem) => void): void {
    this.onBuy = onBuy;
    this.onSell = onSell;
    this.container.setAlpha(0).setScale(0.92);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 220, ease: 'Back.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleX: 0.92, scaleY: 0.92,
      duration: 160, ease: 'Cubic.easeIn',
    });
  }

  private _refreshTabs(): void {
    // 탭 재생성 생략 — 실제 구현에서는 각 탭의 Graphics를 재드로우
  }

  private _refreshGrid(): void {
    this.itemSlots.forEach(s => s.destroy());
    this.itemSlots = [];

    const startX = SHOP.PADDING;
    const startY = SHOP.HEADER_H + 40;
    const GRADE_COLORS: Record<string, number> = {
      common: 0x888888, uncommon: 0x44ff88, rare: 0x4488ff,
      epic: 0xaa44ff, legendary: 0xff8800,
    };

    this.items.forEach((item, i) => {
      const col = i % SHOP.SLOT_COLS;
      const row = Math.floor(i / SHOP.SLOT_COLS);
      const sx = startX + col * (SHOP.SLOT_SIZE + 6);
      const sy = startY + row * (SHOP.SLOT_SIZE + 6);
      const S  = SHOP.SLOT_SIZE;
      const isSelected = i === this.selectedIndex;
      const gradeColor = GRADE_COLORS[item.grade] ?? 0x888888;

      const bg = this.scene.add.graphics()
        .fillStyle(0x111122, 0.9)
        .fillRoundedRect(0, 0, S, S, 5)
        .lineStyle(isSelected ? 2 : 1, isSelected ? 0x88aaff : gradeColor, isSelected ? 1 : 0.5)
        .strokeRoundedRect(0, 0, S, S, 5);

      const iconTxt = this.scene.add.text(S / 2, S / 2 - 5, item.icon, {
        fontSize: '20px', fontFamily: 'monospace',
      }).setOrigin(0.5);

      const priceTxt = this.scene.add.text(S / 2, S - 8, `${item.price}G`, {
        fontSize: '9px', fontFamily: 'monospace', color: SHOP.GOLD_COLOR,
      }).setOrigin(0.5);

      // 품절 오버레이
      if (item.stock === 0) {
        const sold = this.scene.add.graphics()
          .fillStyle(0x000000, 0.6).fillRoundedRect(0, 0, S, S, 5);
        const soldTxt = this.scene.add.text(S / 2, S / 2, '품절', {
          fontSize: '10px', fontFamily: SHOP.FONT, color: '#ff4444',
        }).setOrigin(0.5);
        const slot = this.scene.add.container(sx, sy, [bg, iconTxt, priceTxt, sold, soldTxt]);
        this.container.add(slot);
        this.itemSlots.push(slot);
        return;
      }

      const slot = this.scene.add.container(sx, sy, [bg, iconTxt, priceTxt]);
      bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, S, S), Phaser.Geom.Rectangle.Contains);
      bg.on('pointerover', () => {
        this.selectedIndex = i;
        this.descText.setText(`${item.name}\n${item.description}`);
        this._refreshGrid();
      });
      bg.on('pointerdown', () => {
        this.selectedIndex = i;
        this.scene.tweens.add({ targets: slot, scaleX: 0.9, scaleY: 0.9, yoyo: true, duration: 60 });
      });

      this.container.add(slot);
      this.itemSlots.push(slot);
    });
  }

  private _handleAction(): void {
    if (this.selectedIndex < 0) return;
    const item = this.items[this.selectedIndex];
    if (!item) return;
    if (this.activeTab === 'buy')  this.onBuy?.(item);
    if (this.activeTab === 'sell') this.onSell?.(item);
  }

  destroy(): void { this.container.destroy(); }
}
```

---

## 3. 거래 확인 다이얼로그

```typescript
// src/ui/TradeConfirmDialog.ts

export class TradeConfirmDialog {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(
    action: '구매' | '판매',
    itemName: string,
    price: number,
    playerGold: number,
    onConfirm: () => void,
    onCancel: () => void,
  ): void {
    this._build(action, itemName, price, playerGold, onConfirm, onCancel);

    this.container.setAlpha(0).setScale(0.85);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 180, ease: 'Back.easeOut',
    });
  }

  private _build(
    action: string, itemName: string, price: number,
    gold: number, onConfirm: () => void, onCancel: () => void,
  ): void {
    this.container?.destroy();
    const { width: W, height: H } = this.scene.scale;
    const DW = 260, DH = 140;
    const px = (W - DW) / 2, py = (H - DH) / 2;

    // 어두운 배경 오버레이
    const dim = this.scene.add.rectangle(W / 2 - px, H / 2 - py, W, H, 0x000000, 0.45)
      .setScrollFactor(0);

    const bg = this.scene.add.graphics()
      .fillStyle(0x111122, 0.97)
      .fillRoundedRect(0, 0, DW, DH, 8)
      .lineStyle(1.5, 0x4455aa, 1)
      .strokeRoundedRect(0, 0, DW, DH, 8);

    const titleTxt = this.scene.add.text(DW / 2, 14, `${action} 확인`, {
      fontSize: '14px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#aaccff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const bodyTxt = this.scene.add.text(DW / 2, 46,
      `${itemName}\n${price}G`, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#ffffff', align: 'center',
    }).setOrigin(0.5);

    const afford = gold >= price;
    const goldTxt = this.scene.add.text(DW / 2, 76,
      `보유: ${gold}G  →  ${afford ? gold - price : '부족'}G`, {
      fontSize: '11px', fontFamily: 'monospace',
      color: afford ? '#ffcc44' : '#ff4444',
    }).setOrigin(0.5);

    // 확인 버튼
    const confirmBg = this.scene.add.graphics()
      .fillStyle(afford ? 0x2255aa : 0x333344, 1)
      .fillRoundedRect(0, 0, 100, 28, 5);
    const confirmTxt = this.scene.add.text(50, 14, '확인', {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: afford ? '#ffffff' : '#555566', fontStyle: 'bold',
    }).setOrigin(0.5);

    if (afford) {
      confirmBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 28), Phaser.Geom.Rectangle.Contains);
      confirmBg.on('pointerdown', () => { this._dismiss(); onConfirm(); });
    }
    const confirmContainer = this.scene.add.container(DW / 2 - 110, DH - 40, [confirmBg, confirmTxt]);

    // 취소 버튼
    const cancelBg = this.scene.add.graphics()
      .fillStyle(0x333333, 1).fillRoundedRect(0, 0, 100, 28, 5)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 28), Phaser.Geom.Rectangle.Contains);
    cancelBg.on('pointerdown', () => { this._dismiss(); onCancel(); });
    const cancelTxt = this.scene.add.text(50, 14, '취소', {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif', color: '#aaaaaa',
    }).setOrigin(0.5);
    const cancelContainer = this.scene.add.container(DW / 2 + 10, DH - 40, [cancelBg, cancelTxt]);

    this.container = this.scene.add.container(px, py, [
      dim, bg, titleTxt, bodyTxt, goldTxt, confirmContainer, cancelContainer,
    ]).setDepth(190).setScrollFactor(0).setAlpha(0);
  }

  private _dismiss(): void {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, scaleX: 0.9, scaleY: 0.9,
      duration: 130,
      onComplete: () => this.container?.destroy(),
    });
  }

  destroy(): void { this.container?.destroy(); }
}
```

---

## 4. 골드 코인 이펙트

```typescript
// src/rendering/GoldCoinFX.ts

/** 구매/판매 시 코인이 날아가는 이펙트 */
export function playGoldSpendFX(
  scene: Phaser.Scene,
  fromX: number, fromY: number,
  toX: number,   toY: number,
  amount: number,
): void {
  const count = Math.min(8, Math.max(3, Math.floor(amount / 50)));

  for (let i = 0; i < count; i++) {
    const coin = scene.add.graphics()
      .fillStyle(0xffcc22, 1)
      .fillCircle(0, 0, 4)
      .lineStyle(1, 0xaa8800, 1)
      .strokeCircle(0, 0, 4)
      .setPosition(fromX + Phaser.Math.Between(-10, 10), fromY + Phaser.Math.Between(-8, 8))
      .setDepth(195)
      .setScrollFactor(0);

    // 포물선 경로: 중간 제어점 위쪽으로
    const midX = (fromX + toX) / 2 + Phaser.Math.Between(-20, 20);
    const midY = Math.min(fromY, toY) - Phaser.Math.Between(30, 60);

    const t = { progress: 0 };
    scene.tweens.add({
      targets: t,
      progress: 1,
      duration: 400 + i * 40,
      delay: i * 35,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const p = t.progress;
        // 2차 베지어
        const bx = (1-p)*(1-p)*fromX + 2*(1-p)*p*midX + p*p*toX;
        const by = (1-p)*(1-p)*fromY + 2*(1-p)*p*midY + p*p*toY;
        coin.setPosition(bx, by);
        coin.setAlpha(p < 0.8 ? 1 : 1 - (p - 0.8) * 5);
      },
      onComplete: () => coin.destroy(),
    });
  }
}

/** 아이템 판매 시 골드 획득 텍스트 */
export function playGoldGainFX(
  scene: Phaser.Scene,
  x: number, y: number,
  amount: number,
): void {
  const txt = scene.add.text(x, y, `+${amount}G`, {
    fontSize: '18px', fontFamily: 'monospace',
    fontStyle: 'bold', color: '#ffee44',
    stroke: '#664400', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(196).setScrollFactor(0);

  scene.tweens.add({
    targets: txt,
    y: y - 40, alpha: 0,
    duration: 700, ease: 'Sine.easeOut',
    onComplete: () => txt.destroy(),
  });

  // 아래에서 위로 작은 별 파티클
  for (let i = 0; i < 5; i++) {
    const star = scene.add.graphics()
      .fillStyle(0xffcc22, 0.9)
      .fillCircle(0, 0, 2)
      .setPosition(x + Phaser.Math.Between(-16, 16), y)
      .setDepth(195).setScrollFactor(0);
    scene.tweens.add({
      targets: star,
      y: y - Phaser.Math.Between(20, 50),
      x: star.x + Phaser.Math.Between(-10, 10),
      alpha: 0,
      duration: 500,
      delay: i * 50,
      ease: 'Sine.easeOut',
      onComplete: () => star.destroy(),
    });
  }
}
```

---

## 5. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 상점 패널           | 185   |
| 거래 확인 다이얼로그 | 190   |
| 골드 코인 이펙트    | 195–196 |
