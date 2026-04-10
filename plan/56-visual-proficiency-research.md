# Plan 56 — 숙련도·연구 UI 비주얼 (Visual Proficiency & Research)

## 개요

plan 14(숙련도·연구·레시피 해금)의 데이터 구조를 바탕으로  
숙련도 패널, 경험치 바 애니메이션, 레벨업 연출, 연구 트리 노드 시각,  
레시피 해금 플래시를 설계한다.

---

## 1. 숙련도 패널 (`ProficiencyPanel`)

### 1-1. 패널 레이아웃

```
┌────────────────────────────────────── 숙련도 ──┐
│                                                  │
│  🪓 벌목      Lv.4  ████████░░  820 / 1020 XP  │
│  ⛏ 채광      Lv.3  ██████░░░░  380 / 450  XP  │
│  🎣 낚시      Lv.2  ████░░░░░░  95  / 130  XP  │
│  🔨 제작      Lv.5  ██████████  MAXED           │
│  🏗 건축      Lv.1  ██░░░░░░░░  30  / 50   XP  │
│  🍳 요리      Lv.6  ████████░░  880 / 1020 XP  │
│  ⚔ 전투      Lv.2  ███░░░░░░░  110 / 130  XP  │
│  🌾 농업      Lv.1  █░░░░░░░░░  10  / 50   XP  │
│                                                  │
└──────────────────────────────────────────────────┘
```

- 패널 크기: 340×250px
- 배경: plan 43 `UI_COLORS.panelBg` + 테두리 `panelBorder`
- 각 행 높이: 26px

### 1-2. 숙련도 아이콘 & 색상

```typescript
const PROF_CONFIG: Record<ProficiencyId, { icon: string; color: number }> = {
  woodcutting: { icon: '🪓', color: 0x8a6030 },
  mining:      { icon: '⛏', color: 0x808080 },
  fishing:     { icon: '🎣', color: 0x4080c0 },
  crafting:    { icon: '🔨', color: 0x8060c0 },
  building:    { icon: '🏗', color: 0xc8a030 },
  cooking:     { icon: '🍳', color: 0xe06020 },
  combat:      { icon: '⚔', color: 0xe04040 },
  farming:     { icon: '🌾', color: 0x60a830 },
};
```

### 1-3. 경험치 바 렌더링 (`drawProficiencyBar`)

```typescript
function drawProficiencyBar(
  ctx: CanvasRenderingContext2D,
  prof: ProficiencyData,    // { id, level, xp, nextLevelXp }
  x: number, y: number, w: number
): void {
  const cfg   = PROF_CONFIG[prof.id];
  const ratio = prof.xp / prof.nextLevelXp;
  const BH    = 8;   // 바 높이

  // 아이콘 (14px)
  ctx.font = '12px serif';
  ctx.fillText(cfg.icon, x, y + 14);

  // 이름 (plan 43 UI_FONT.primary)
  ctx.fillStyle = '#e8d8b0';
  ctx.font = '10px Courier New';
  ctx.fillText(getProfName(prof.id), x + 18, y + 13);

  // 레벨
  ctx.fillStyle = '#' + cfg.color.toString(16).padStart(6,'0');
  ctx.font = 'bold 10px Courier New';
  ctx.fillText(`Lv.${prof.level}`, x + 80, y + 13);

  // 경험치 바 (plan 43 drawGauge 스타일)
  const bx = x + 110;
  // 배경
  ctx.fillStyle = '#1a1408';
  roundRect(ctx, bx, y + 4, w - 110, BH, 2); ctx.fill();
  // 채움
  if (prof.level < 10) {
    ctx.fillStyle = '#' + cfg.color.toString(16).padStart(6,'0');
    roundRect(ctx, bx, y + 4, (w - 110) * ratio, BH, 2); ctx.fill();
    // 하이라이트 (상단 1px)
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(bx + 1, y + 4, (w - 112) * ratio, 1);
  } else {
    // MAX: 금색 채움 + 텍스트
    ctx.fillStyle = '#f0c030';
    roundRect(ctx, bx, y + 4, w - 110, BH, 2); ctx.fill();
    ctx.fillStyle = '#3a2808';
    ctx.font = 'bold 7px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('MAX', bx + (w - 110) / 2, y + 11);
    ctx.textAlign = 'left';
    return;
  }

  // XP 수치 (오른쪽)
  ctx.fillStyle = '#a09070';
  ctx.font = '9px Courier New';
  ctx.textAlign = 'right';
  ctx.fillText(`${prof.xp} / ${prof.nextLevelXp}`, x + w, y + 13);
  ctx.textAlign = 'left';
}
```

### 1-4. XP 획득 시 바 애니메이션

```typescript
class ProficiencyBarAnimator {
  private tweens = new Map<ProficiencyId, Phaser.Tweens.Tween>();

  animateXpGain(id: ProficiencyId, prevXp: number, newXp: number, maxXp: number): void {
    const barObj = { xp: prevXp };
    const existing = this.tweens.get(id);
    existing?.stop();

    const tween = scene.tweens.add({
      targets: barObj,
      xp: Math.min(newXp, maxXp),
      duration: 600,
      ease: 'Quad.easeOut',
      onUpdate: () => redrawProfBar(id, barObj.xp, maxXp),
      onComplete: () => {
        if (newXp >= maxXp) this.triggerLevelUpGlow(id);
      }
    });
    this.tweens.set(id, tween);
  }

  // 레벨업 직전 바가 꽉 찰 때 글로우 pulse
  private triggerLevelUpGlow(id: ProficiencyId): void {
    const barGfx = getProfBarGraphics(id);
    scene.tweens.add({
      targets: barGfx,
      alpha: { from: 1.0, to: 0.4 },
      duration: 200, yoyo: true, repeat: 2,
      onComplete: () => barGfx.setAlpha(1.0)
    });
  }
}
```

---

## 2. 레벨업 연출 (`ProfLevelUpEffect`)

plan 49 `playLevelUpEffect`(전역)에서 숙련도별 색상 적용 확장.

```typescript
function playProfLevelUpEffect(id: ProficiencyId, newLevel: number): void {
  const cfg = PROF_CONFIG[id];
  const player = getLocalPlayerSprite();

  // 1. 2개 확장 링 (plan 49 방식 + 숙련도 색상)
  [0, 150].forEach(delay => {
    scene.time.delayedCall(delay, () => {
      const gfx = scene.add.graphics().setDepth(75);
      scene.tweens.add({
        targets: { r: 0 }, r: 64,
        duration: 500, ease: 'Quad.easeOut',
        onUpdate: (tw, obj) => {
          gfx.clear();
          gfx.lineStyle(2, cfg.color, 1 - obj.r / 64);
          gfx.strokeCircle(player.x, player.y, obj.r);
        },
        onComplete: () => gfx.destroy()
      });
    });
  });

  // 2. 아이콘 + 레벨 팝업 텍스트 (숙련도 색)
  const popup = scene.add.text(
    player.x, player.y - 48,
    `${cfg.icon} Lv.${newLevel}!`,
    {
      fontSize: '14px', fontFamily: 'Courier New',
      color: '#' + cfg.color.toString(16).padStart(6,'0'),
      stroke: '#000000', strokeThickness: 3
    }
  ).setDepth(90).setOrigin(0.5);

  scene.tweens.add({
    targets: popup,
    scaleX: [0.5, 1.3, 1.0], scaleY: [0.5, 1.3, 1.0],
    duration: 400, ease: 'Back.easeOut'
  });
  scene.time.delayedCall(1800, () => {
    scene.tweens.add({
      targets: popup, y: popup.y - 20, alpha: 0,
      duration: 400, onComplete: () => popup.destroy()
    });
  });

  // 3. 12개 방사형 별 파티클 (숙련도 색)
  const emitter = scene.add.particles(player.x, player.y, 'fx_pixel', {
    tint:    [cfg.color, 0xffffff],
    speed:   { min: 60, max: 140 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 1.4, end: 0 },
    lifespan: 700, quantity: 12, emitting: false
  }).setDepth(75);
  emitter.explode(12);
  scene.time.delayedCall(800, () => emitter.destroy());

  // 4. plan 37 NotifySystem
  NotifySystem.show('info', `${getProfName(id)} 숙련도 Lv.${newLevel} 달성!`);
}
```

---

## 3. 연구 패널 (`ResearchPanel`)

### 3-1. 연구 트리 노드 레이아웃

```
    [벌목 Lv.2]──────[도끼 제작법]──────[강철 도끼]
         │
    [채광 Lv.3]──────[석재 가공술]
         │
    [제작 Lv.4]──────[작업대 II]──────[방어구 제작]
```

노드 외형 (64×40px):

```typescript
function drawResearchNode(
  ctx: CanvasRenderingContext2D,
  node: ResearchNode,
  state: 'locked' | 'available' | 'researching' | 'unlocked'
): void {
  const W = 64, H = 40;

  const colors = {
    locked:      { bg: 0x1a1408, border: 0x3a2a14, text: '#555545' },
    available:   { bg: 0x2a2010, border: 0x8a6030, text: '#e8d8b0' },
    researching: { bg: 0x2a2010, border: 0xf0c030, text: '#f0c030' },
    unlocked:    { bg: 0x182018, border: 0x40a830, text: '#80e060' },
  }[state];

  // 배경
  ctx.fillStyle = hexToRgba(colors.bg);
  roundRect(ctx, 0, 0, W, H, 4); ctx.fill();

  // 테두리
  ctx.strokeStyle = '#' + colors.border.toString(16).padStart(6,'0');
  ctx.lineWidth = state === 'researching' ? 2 : 1;
  roundRect(ctx, 0, 0, W, H, 4); ctx.stroke();

  // 잠금 아이콘 or 아이콘
  if (state === 'locked') {
    ctx.fillStyle = '#555545';
    ctx.font = '14px serif'; ctx.textAlign = 'center';
    ctx.fillText('🔒', W/2, 22);
  } else {
    ctx.fillStyle = colors.text;
    ctx.font = '9px Courier New'; ctx.textAlign = 'center';
    ctx.fillText(node.icon, W/2, 16);
    ctx.fillText(node.name.slice(0, 7), W/2, 30);
  }

  // 연구 중: 하단 진행 바
  if (state === 'researching') {
    ctx.fillStyle = '#1a1408';
    ctx.fillRect(4, H - 6, W - 8, 3);
    ctx.fillStyle = '#f0c030';
    ctx.fillRect(4, H - 6, (W - 8) * node.progress, 3);
  }
  // 완료: 오른쪽 하단 ✓
  if (state === 'unlocked') {
    ctx.fillStyle = '#40e060';
    ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'right';
    ctx.fillText('✓', W - 4, H - 3);
  }
}
```

### 3-2. 노드 연결선

```typescript
function drawResearchEdge(
  ctx: CanvasRenderingContext2D,
  fromCenter: { x: number; y: number },
  toCenter:   { x: number; y: number },
  unlocked: boolean
): void {
  ctx.strokeStyle = unlocked ? 'rgba(64,168,48,0.7)' : 'rgba(90,70,40,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash(unlocked ? [] : [4, 4]);

  // L자 꺾임 선 (수평 → 수직)
  const midX = (fromCenter.x + toCenter.x) / 2;
  ctx.beginPath();
  ctx.moveTo(fromCenter.x, fromCenter.y);
  ctx.lineTo(midX, fromCenter.y);
  ctx.lineTo(midX, toCenter.y);
  ctx.lineTo(toCenter.x, toCenter.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 끝 화살 (→)
  if (unlocked) {
    ctx.fillStyle = 'rgba(64,168,48,0.8)';
    ctx.beginPath();
    ctx.moveTo(toCenter.x - 6, toCenter.y - 4);
    ctx.lineTo(toCenter.x,     toCenter.y);
    ctx.lineTo(toCenter.x - 6, toCenter.y + 4);
    ctx.fill();
  }
}
```

### 3-3. 연구 진행 타이머 시각

```typescript
class ResearchProgressIndicator {
  // 연구 중인 노드 위: 모래시계 아이콘 + 남은 시간 텍스트
  showActiveResearch(node: ResearchNode, remainSec: number): void {
    // 노드 위 토스트 스타일 (plan 37 연계)
    // "⏳ 도끼 제작법 연구 중 (00:45)" 형태
    const mm = Math.floor(remainSec / 60).toString().padStart(2,'0');
    const ss = (remainSec % 60).toString().padStart(2,'0');
    NotifySystem.updatePersistent('research', `⏳ ${node.name} 연구 중 (${mm}:${ss})`);
  }

  // 완료 시
  onResearchComplete(node: ResearchNode): void {
    NotifySystem.clearPersistent('research');
    playResearchUnlockEffect(node);
  }
}
```

---

## 4. 레시피·도면 해금 이펙트 (`RecipeUnlockEffect`)

```typescript
function playResearchUnlockEffect(node: ResearchNode): void {
  const cam = scene.cameras.main;
  const cx = cam.width / 2, cy = cam.height / 2;

  // 1. 화면 중앙 황금 플래시 (0.2s)
  const flash = scene.add.graphics().setScrollFactor(0).setDepth(118);
  flash.fillStyle(0xf0c030, 0.0);
  flash.fillRect(0, 0, cam.width, cam.height);
  scene.tweens.add({
    targets: flash,
    alpha: { from: 0, to: 0.25 },
    duration: 100, yoyo: true,
    onComplete: () => flash.destroy()
  });

  // 2. 노드 아이콘 대형 팝업 (48px → 32px scale down)
  const iconTxt = scene.add.text(cx, cy - 30, node.icon, {
    fontSize: '48px'
  }).setScrollFactor(0).setDepth(122).setOrigin(0.5).setScale(2).setAlpha(0);
  scene.tweens.add({
    targets: iconTxt,
    alpha: 1, scaleX: 1, scaleY: 1,
    duration: 400, ease: 'Back.easeOut'
  });

  // 3. "해금!" 텍스트 + 노드 이름
  const msg = scene.add.text(cx, cy + 20,
    `${node.name}\n해금!`, {
      fontSize: '16px', fontFamily: 'Courier New',
      color: '#f0c030', stroke: '#000000', strokeThickness: 3,
      align: 'center'
    }
  ).setScrollFactor(0).setDepth(122).setOrigin(0.5).setAlpha(0);
  scene.time.delayedCall(200, () => {
    scene.tweens.add({ targets: msg, alpha: 1, duration: 200 });
  });

  // 4. 황금 파티클 16개
  const emitter = scene.add.particles(cx, cy, 'fx_pixel', {
    tint:    [0xf0c030, 0xffffff, 0xffd060],
    speed:   { min: 80, max: 180 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 1.5, end: 0 },
    lifespan: 800, quantity: 16, emitting: false
  }).setScrollFactor(0).setDepth(120);
  emitter.explode(16);

  // 5. 3s 뒤 fade out
  scene.time.delayedCall(3000, () => {
    scene.tweens.add({
      targets: [iconTxt, msg],
      alpha: 0, y: '-=20',
      duration: 400,
      onComplete: () => { iconTxt.destroy(); msg.destroy(); emitter.destroy(); }
    });
  });
}
```

---

## 5. 숙련도 패널 열기/닫기

```typescript
class ProficiencyPanel {
  open(): void {
    // 왼쪽에서 슬라이드 인 (0.25s)
    this.container.setVisible(true).setX(-340).setAlpha(0);
    scene.tweens.add({
      targets: this.container,
      x: 20, alpha: 1,
      duration: 250, ease: 'Quad.easeOut'
    });
    // 딤 오버레이 (plan 54 TutorialSpotlight과 다른 가벼운 딤)
    this.dimGfx.setAlpha(0).setVisible(true);
    scene.tweens.add({ targets: this.dimGfx, alpha: 0.45, duration: 200 });
  }

  close(): void {
    scene.tweens.add({
      targets: this.container,
      x: -340, alpha: 0,
      duration: 200,
      onComplete: () => this.container.setVisible(false)
    });
    scene.tweens.add({
      targets: this.dimGfx, alpha: 0, duration: 200,
      onComplete: () => this.dimGfx.setVisible(false)
    });
  }
}
```

---

## 6. 연구 패널 레이아웃 탭

숙련도 패널과 연구 패널을 탭으로 전환:

```typescript
// 패널 상단 탭 2개
// [숙련도] [연구]
// 활성 탭: 하단 3px 황금 밑줄 + bold

function drawPanelTab(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number, y: number, w: number,
  active: boolean
): void {
  ctx.fillStyle = active ? '#2a2010' : '#181208';
  roundRect(ctx, x, y, w, 24, [4, 4, 0, 0]); ctx.fill();

  ctx.fillStyle = active ? '#f0c030' : '#888870';
  ctx.font = active ? 'bold 11px Courier New' : '11px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w/2, y + 16);

  if (active) {
    ctx.fillStyle = '#f0c030';
    ctx.fillRect(x, y + 21, w, 3);
  }
}
```

---

## 7. 깊이(Depth) 할당

| 오브젝트 | depth | ScrollFactor |
|----------|-------|--------------|
| 숙련도/연구 패널 딤 | 79 | 0 |
| 숙련도/연구 패널 | 80 | 0 |
| 레벨업 링 파티클 | 75 | — |
| 레벨업 텍스트 팝업 | 90 | — |
| 연구 해금 플래시 | 118 | 0 |
| 연구 해금 아이콘/텍스트 | 122 | 0 |

---

## 8. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/ProficiencyPanel.ts` | 패널 레이아웃, 탭, 슬라이드 애니 |
| `src/ui/ResearchPanel.ts` | 트리 노드, 연결선, 진행 타이머 |
| `src/ui/ProficiencyBarAnimator.ts` | XP 바 tween, 레벨업 글로우 |
| `src/systems/ProfLevelUpEffect.ts` | 링 파티클, 팝업 텍스트, notify |
| `src/systems/RecipeUnlockEffect.ts` | 해금 플래시, 아이콘 팝업 |
| `src/generators/SpriteGenerator.ts` | drawResearchNode 추가 |

---

## 9. 버전

`v0.56.0`
