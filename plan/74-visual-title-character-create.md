# Plan 74 — 타이틀·캐릭터 생성 화면 비주얼

## 개요

plan 19(캐릭터 생성)·plan 64(초기 빌드 선택)에서 정의한 타이틀 화면과  
캐릭터 생성 흐름에 **애니메이션 배경·스타터 빌드 선택 카드·입력 폼 트랜지션**을  
추가하여 게임 첫인상을 완성한다.

---

## 1. 타이틀 화면 배경 애니메이션

```typescript
class TitleBackground {
  private stars: Phaser.GameObjects.Graphics;
  private treeLine: Phaser.GameObjects.Graphics;
  private moonGfx: Phaser.GameObjects.Graphics;
  private phase = 0;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // 1. 그라디언트 하늘 (새벽 → 낮 순환, 60초 주기)
    const sky = scene.add.graphics().setDepth(0);
    scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this.phase = (this.phase + 0.05 / 60) % 1;
        sky.clear();
        const topColor  = lerpColorHex(0x0a0a1a, 0x1a3a6a, this.phase);
        const botColor  = lerpColorHex(0x1a1a2e, 0x4a7ab5, this.phase);
        sky.fillGradientStyle(topColor, topColor, botColor, botColor, 1);
        sky.fillRect(0, 0, W, H);
      },
    });

    // 2. 별 레이어 (밤 → 새벽 페이드아웃)
    this.stars = scene.add.graphics().setDepth(1);
    this.drawStars(W, H);

    // 3. 원경 산 실루엣 (parallax 2계층)
    this.drawMountains(scene, W, H);

    // 4. 전경 나무 실루엣 (천천히 바람에 흔들)
    this.treeLine = scene.add.graphics().setDepth(3);
    this.animateTrees(scene, W, H);

    // 5. 달 (왼쪽 상단 → 오른쪽 호를 그리며 이동, 60초 주기)
    this.moonGfx = scene.add.graphics().setDepth(2);
    scene.events.on('update', this.updateMoon, this);
  }

  private drawStars(W: number, H: number): void {
    const rng = new Phaser.Math.RandomDataGenerator(['title_stars']);
    for (let i = 0; i < 80; i++) {
      const x = rng.frac() * W;
      const y = rng.frac() * H * 0.6;
      const r = 0.5 + rng.frac() * 1;
      this.stars.fillStyle(0xffffff, 0.4 + rng.frac() * 0.6);
      this.stars.fillCircle(x, y, r);
    }
  }

  private drawMountains(scene: Phaser.Scene, W: number, H: number): void {
    // 원경 (어두운 파랑)
    const far = scene.add.graphics().setDepth(2);
    far.fillStyle(0x1a2a4a, 1);
    far.beginPath();
    far.moveTo(0, H * 0.55);
    for (let x = 0; x <= W; x += 40) {
      const y = H * 0.55 - Math.sin(x * 0.012) * 60 - Math.sin(x * 0.007 + 1) * 30;
      far.lineTo(x, y);
    }
    far.lineTo(W, H); far.lineTo(0, H); far.closePath(); far.fillPath();

    // 근경 (더 어두운 초록빛 검정)
    const near = scene.add.graphics().setDepth(3);
    near.fillStyle(0x0a1a0a, 1);
    near.beginPath();
    near.moveTo(0, H * 0.72);
    for (let x = 0; x <= W; x += 20) {
      const y = H * 0.72 - Math.abs(Math.sin(x * 0.02 + 0.5)) * 80 - Math.sin(x * 0.015) * 20;
      near.lineTo(x, y);
    }
    near.lineTo(W, H); near.lineTo(0, H); near.closePath(); near.fillPath();
  }

  private animateTrees(scene: Phaser.Scene, W: number, H: number): void {
    let windPhase = 0;
    scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        windPhase += 0.04;
        this.treeLine.clear();
        this.treeLine.fillStyle(0x050d05, 1);
        // 15그루 나무 (좌우 흔들림)
        for (let i = 0; i < 15; i++) {
          const tx = (i / 14) * W;
          const ty = H * 0.78;
          const sway = Math.sin(windPhase + i * 0.8) * 2;
          drawPixelTree(this.treeLine, tx + sway, ty, 18 + (i % 3) * 6);
        }
      },
    });
  }

  private updateMoon(_time: number): void {
    const t = this.phase;
    const arc = Math.PI * t;
    const mx = 50 + Math.cos(Math.PI - arc) * 160;
    const my = 80 - Math.sin(arc) * 60;
    this.moonGfx.clear();
    this.moonGfx.fillStyle(0xeeeebb, 0.9 - t * 0.5);
    this.moonGfx.fillCircle(mx, my, 16);
    this.moonGfx.fillStyle(0x0a0a1a, 1);
    this.moonGfx.fillCircle(mx + 6, my - 2, 14);  // 초승달 마스크
  }
}

function drawPixelTree(gfx: Phaser.GameObjects.Graphics, x: number, y: number, h: number): void {
  // 삼각형 3단 나무
  for (let tier = 0; tier < 3; tier++) {
    const tw = h * 0.6 * (1 - tier * 0.2);
    const ty = y - tier * h * 0.35;
    gfx.fillTriangle(x, ty - h * 0.4, x - tw / 2, ty, x + tw / 2, ty);
  }
  gfx.fillRect(x - 3, y, 6, 12);  // 나무 기둥
}
```

---

## 2. 타이틀 로고 애니메이션

```typescript
function playTitleLogoEntrance(scene: Phaser.Scene): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  // 메인 타이틀 텍스트
  const title = scene.add.text(W / 2, H * 0.3, 'BASECAMP', {
    fontSize: '42px',
    color: '#f0c030',
    fontFamily: 'Courier New',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 6,
    shadow: { x: 2, y: 2, color: '#000', blur: 4, fill: true },
  }).setOrigin(0.5).setDepth(10).setAlpha(0).setScale(0.6);

  // 서브 타이틀
  const sub = scene.add.text(W / 2, H * 0.3 + 52, 'Survival Simulation', {
    fontSize: '14px',
    color: '#aaaaaa',
    fontFamily: 'Courier New',
    letterSpacing: 4,
  }).setOrigin(0.5).setDepth(10).setAlpha(0);

  // 로고 슬라이드 인
  scene.tweens.add({
    targets: title,
    alpha: 1,
    scaleX: 1, scaleY: 1,
    duration: 800,
    ease: 'Back.easeOut',
    delay: 300,
  });
  scene.tweens.add({
    targets: sub,
    alpha: 1,
    duration: 600,
    delay: 900,
  });

  // 타이틀 글자 황금 반짝임 (주기적)
  scene.time.delayedCall(1500, () => {
    scene.tweens.add({
      targets: title,
      scaleX: 1.03, scaleY: 1.03,
      duration: 200,
      yoyo: true,
      repeat: -1,
      repeatDelay: 4000,
      ease: 'Sine.easeInOut',
    });
  });
}
```

---

## 3. 스타터 빌드 선택 카드 UI

plan 64의 5가지 초기 빌드를 카드 형태로 표시:

```typescript
interface BuildCardConfig {
  key:   string;
  label: string;
  emoji: string;
  desc:  string;
  color: number;
  stats: string;
}

const BUILD_CARDS: BuildCardConfig[] = [
  { key: 'warrior',  label: '전사',   emoji: '⚔',  desc: '근접전 특화',    color: 0xcc4444, stats: 'STR+3 CON+2' },
  { key: 'scout',    label: '정찰자', emoji: '🏃',  desc: '이동·낚시 특화', color: 0x44cc88, stats: 'AGI+3 LUK+2' },
  { key: 'builder',  label: '건축가', emoji: '🔨',  desc: '제작·건설 특화', color: 0xcc8844, stats: 'INT+3 CON+2' },
  { key: 'survivor', label: '생존자', emoji: '🛡',  desc: 'HP·회복 특화',   color: 0x4488cc, stats: 'CON+3 INT+2' },
  { key: 'balanced', label: '균형',   emoji: '⚖',  desc: '전 능력치 균형',  color: 0xaaaaaa, stats: 'ALL+1'      },
];

class StarterBuildSelector {
  private cards: Phaser.GameObjects.Container[] = [];
  private selectedKey = 'balanced';

  show(scene: Phaser.Scene, onSelect: (key: string) => void): void {
    const W = scene.cameras.main.width;
    const CY = scene.cameras.main.height * 0.62;
    const CARD_W = 90, CARD_H = 110, GAP = 10;
    const totalW = BUILD_CARDS.length * (CARD_W + GAP) - GAP;
    const startX = (W - totalW) / 2;

    BUILD_CARDS.forEach((cfg, i) => {
      const cx = startX + i * (CARD_W + GAP) + CARD_W / 2;
      const container = scene.add.container(cx, CY + 60).setDepth(12);

      // 카드 배경
      const bg = scene.add.graphics();
      bg.fillStyle(0x111111, 0.85);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
      bg.lineStyle(2, cfg.color, 0.7);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);

      // 이모지 아이콘
      const icon = scene.add.text(0, -30, cfg.emoji, { fontSize: '22px' }).setOrigin(0.5);

      // 이름
      const nameT = scene.add.text(0, -4, cfg.label, {
        fontSize: '12px', color: `#${cfg.color.toString(16).padStart(6,'0')}`,
        fontFamily: 'Courier New', fontStyle: 'bold',
      }).setOrigin(0.5);

      // 설명
      const descT = scene.add.text(0, 14, cfg.desc, {
        fontSize: '9px', color: '#888888', fontFamily: 'Courier New',
      }).setOrigin(0.5);

      // 스탯
      const statT = scene.add.text(0, 32, cfg.stats, {
        fontSize: '9px', color: '#ccccaa', fontFamily: 'Courier New',
      }).setOrigin(0.5);

      container.add([bg, icon, nameT, descT, statT]);
      container.setAlpha(0);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
        Phaser.Geom.Rectangle.Contains
      );

      // 슬라이드 인 (순서대로)
      scene.tweens.add({
        targets: container,
        alpha: 1,
        y: CY,
        duration: 300,
        delay: i * 80,
        ease: 'Back.easeOut',
      });

      container.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(cfg.color, 0.15);
        bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
        bg.lineStyle(2, cfg.color, 1.0);
        bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
        scene.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 100 });
      });

      container.on('pointerout', () => {
        if (this.selectedKey !== cfg.key) {
          bg.clear();
          bg.fillStyle(0x111111, 0.85);
          bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
          bg.lineStyle(2, cfg.color, 0.7);
          bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);
        }
        scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 100 });
      });

      container.on('pointerdown', () => {
        this.selectedKey = cfg.key;
        this.highlightSelected(scene, cfg);
        onSelect(cfg.key);
        this.playSelectEffect(scene, container, cfg.color);
      });

      this.cards.push(container);
    });
  }

  private playSelectEffect(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    color: number
  ): void {
    // 선택 파티클 버스트
    const emitter = scene.add.particles(container.x, container.y, '__DEFAULT', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.5, end: 0 },
      lifespan: 400,
      quantity: 8,
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(13);
    emitter.explode(8);
    scene.time.delayedCall(500, () => emitter.destroy());

    // 스케일 펀치
    scene.tweens.add({
      targets: container,
      scaleX: 1.15, scaleY: 1.15,
      duration: 100,
      ease: 'Back.easeOut',
      yoyo: true,
    });
  }

  private highlightSelected(scene: Phaser.Scene, selectedCfg: BuildCardConfig): void {
    // 선택된 카드 테두리 강조, 나머지 dimmed
    // (구현은 cards 배열 순회)
    void scene; void selectedCfg;
  }
}
```

---

## 4. 시드 입력 화면 애니메이션

```typescript
function animateSeedInput(scene: Phaser.Scene, inputEl: HTMLInputElement): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  // 입력창 슬라이드 업
  const panel = scene.add.graphics().setScrollFactor(0).setDepth(11);
  const panelY = { y: H + 80 };

  scene.tweens.add({
    targets: panelY,
    y: H * 0.5,
    duration: 400,
    ease: 'Back.easeOut',
    onUpdate: () => {
      panel.clear();
      panel.fillStyle(0x111118, 0.92);
      panel.fillRoundedRect(W / 2 - 160, panelY.y - 44, 320, 88, 8);
      panel.lineStyle(1.5, 0x4488cc, 0.7);
      panel.strokeRoundedRect(W / 2 - 160, panelY.y - 44, 320, 88, 8);
    },
  });

  // 커서 깜빡임 효과 (HTML input에 CSS animation)
  inputEl.style.cssText += `
    border: 2px solid #4488cc;
    animation: inputPulse 2s ease-in-out infinite;
  `;
}

// "게임 시작" 버튼 호버 & 클릭 이펙트
function setupStartButton(scene: Phaser.Scene, btn: Phaser.GameObjects.Text): void {
  btn.setInteractive({ useHandCursor: true });

  btn.on('pointerover', () => {
    scene.tweens.add({ targets: btn, scaleX: 1.06, scaleY: 1.06, duration: 100 });
    btn.setColor('#ffffff');
    btn.setBackgroundColor('#2a5a2a');
  });

  btn.on('pointerout', () => {
    scene.tweens.add({ targets: btn, scaleX: 1.0, scaleY: 1.0, duration: 100 });
    btn.setColor('#88ff88');
    btn.setBackgroundColor('#1a3a1a');
  });

  btn.on('pointerdown', () => {
    // 버튼 클릭 파동 이펙트
    const ring = scene.add.graphics().setDepth(btn.depth + 1);
    const obj = { r: 10 };
    scene.tweens.add({
      targets: obj, r: 60, duration: 400,
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(2, 0x44ff44, 1 - obj.r / 60);
        ring.strokeCircle(btn.x, btn.y, obj.r);
      },
      onComplete: () => ring.destroy(),
    });
  });
}
```

---

## 5. 화면 전환 — 타이틀 → 게임 시작

```typescript
function playGameStartTransition(scene: Phaser.Scene, onComplete: () => void): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  // 1. 화면 줌인 + 블러 페이드 (별이 사라지고 아침이 밝아오는 느낌)
  scene.cameras.main.zoomTo(1.15, 800, 'Linear');

  // 2. 흰색 플래시
  const flash = scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
    .setScrollFactor(0).setDepth(100);

  scene.tweens.add({
    targets: flash,
    alpha: 1,
    duration: 300,
    delay: 600,
    ease: 'Quad.easeIn',
    onComplete: () => onComplete(),
  });

  // 3. 출발 텍스트
  const txt = scene.add.text(W / 2, H / 2, '탐험을 시작합니다!', {
    fontSize: '20px', color: '#000000',
    fontFamily: 'Courier New', fontStyle: 'bold',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0);

  scene.tweens.add({
    targets: txt,
    alpha: 1,
    duration: 200,
    delay: 650,
  });
}
```

---

## 6. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 하늘 그라디언트 | 0 | 최하단 |
| 별 레이어 | 1 | |
| 달 | 2 | |
| 원경 산 | 2 | |
| 근경 산 + 나무 | 3 | |
| 타이틀 로고 | 10 | |
| 스타터 빌드 카드 | 12 | |
| 카드 선택 파티클 | 13 | |
| 게임 시작 플래시 | 100 | |

---

## 7. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/scenes/TitleScene.ts` | 배경 애니메이션, 로고 연출, 전환 |
| `src/ui/StarterBuildSelector.ts` | 빌드 선택 카드 UI |
| `src/ui/SeedInputScreen.ts` | 시드 입력 애니메이션, 시작 버튼 |

---

## 8. 버전

`v0.74.0`
