# Plan 72 — 건축 배치·완공 비주얼

## 개요

plan 12(건축 시스템 고도화)에서 정의한 건축 흐름을  
**배치 고스트 → 격자 스냅 → 건설 진행 → 완공 연출** 단계별로  
시각적으로 표현하는 이펙트와 UI를 설계한다.

---

## 1. 배치 고스트 (Placement Ghost)

마우스/터치를 따라다니는 반투명 건물 미리보기:

```typescript
class PlacementGhost {
  private ghostSprite: Phaser.GameObjects.Image;
  private validOverlay: Phaser.GameObjects.Graphics;   // 녹색/빨간 오버레이
  private gridLines: Phaser.GameObjects.Graphics;      // 스냅 격자

  attach(scene: Phaser.Scene, buildingKey: string, tileW: number, tileH: number): void {
    const PW = tileW * 32;
    const PH = tileH * 32;

    // 반투명 청사진 스프라이트
    this.ghostSprite = scene.add.image(0, 0, buildingKey)
      .setAlpha(0.55)
      .setTint(0x88bbff)       // 기본: 파란 청사진 느낌
      .setDepth(50);

    // 배치 가능/불가 오버레이 (전체 타일 채우기)
    this.validOverlay = scene.add.graphics().setDepth(51);

    // 격자 안내선 (건물 크기 타일 격자)
    this.gridLines = scene.add.graphics().setDepth(49).setAlpha(0.2);
    this.drawGridLines(scene, PW, PH);

    scene.input.on('pointermove', this.onPointerMove, this);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const wx = pointer.worldX;
    const wy = pointer.worldY;

    // 32px 격자 스냅
    const snapX = Math.floor(wx / 32) * 32;
    const snapY = Math.floor(wy / 32) * 32;

    this.ghostSprite.setPosition(
      snapX + this.ghostSprite.width / 2,
      snapY + this.ghostSprite.height / 2
    );

    const canPlace = checkPlacementValid(snapX / 32, snapY / 32);
    this.refreshOverlay(snapX, snapY, canPlace);
    this.ghostSprite.setTint(canPlace ? 0x88ffaa : 0xff6666);
  }

  private refreshOverlay(sx: number, sy: number, canPlace: boolean): void {
    this.validOverlay.clear();
    const color  = canPlace ? 0x44ff88 : 0xff4444;
    const alpha  = canPlace ? 0.12    : 0.22;
    this.validOverlay.fillStyle(color, alpha);
    this.validOverlay.fillRect(sx, sy, this.ghostSprite.width, this.ghostSprite.height);

    // 테두리
    this.validOverlay.lineStyle(1.5, color, canPlace ? 0.6 : 0.9);
    this.validOverlay.strokeRect(sx, sy, this.ghostSprite.width, this.ghostSprite.height);
  }

  private drawGridLines(scene: Phaser.Scene, PW: number, PH: number): void {
    // 주변 10×10 타일 범위 격자 (카메라 이동 따라 재생성 필요)
    const cam = scene.cameras.main;
    const startX = Math.floor(cam.scrollX / 32) * 32;
    const startY = Math.floor(cam.scrollY / 32) * 32;

    this.gridLines.clear();
    this.gridLines.lineStyle(0.5, 0x88aaff, 0.3);

    for (let x = startX; x < startX + cam.width + 32; x += 32) {
      this.gridLines.beginPath();
      this.gridLines.moveTo(x, startY);
      this.gridLines.lineTo(x, startY + cam.height + 32);
      this.gridLines.strokePath();
    }
    for (let y = startY; y < startY + cam.height + 32; y += 32) {
      this.gridLines.beginPath();
      this.gridLines.moveTo(startX, y);
      this.gridLines.lineTo(startX + cam.width + 32, y);
      this.gridLines.strokePath();
    }
  }

  // 배치 확정 플래시
  playConfirm(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.ghostSprite,
      alpha: 1.0,
      scaleX: 1.08, scaleY: 1.08,
      duration: 80,
      yoyo: true,
      onComplete: () => this.destroy(scene),
    });
  }

  destroy(scene: Phaser.Scene): void {
    scene.input.off('pointermove', this.onPointerMove, this);
    this.ghostSprite.destroy();
    this.validOverlay.destroy();
    this.gridLines.destroy();
  }
}
```

---

## 2. 배치 확정 이펙트 (Snap-to-Grid)

```typescript
function playBuildSnapEffect(
  scene: Phaser.Scene,
  tileX: number, tileY: number,
  tileW: number, tileH: number
): void {
  const px = tileX * 32;
  const py = tileY * 32;
  const pw = tileW * 32;
  const ph = tileH * 32;

  // 1. 격자 스냅 링 (네 모서리에서 안쪽으로 수렴)
  for (let ci = 0; ci < 4; ci++) {
    const cx = px + (ci % 2) * pw;
    const cy = py + Math.floor(ci / 2) * ph;
    const ring = scene.add.graphics().setDepth(52);
    ring.lineStyle(1.5, 0x88ffcc, 0.8);
    ring.strokeCircle(cx, cy, 10);

    const targetX = px + pw / 2;
    const targetY = py + ph / 2;
    scene.tweens.add({
      targets: ring,
      x: targetX - cx, y: targetY - cy,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => ring.destroy(),
    });
  }

  // 2. 테두리 펄스
  const border = scene.add.graphics().setDepth(52);
  border.lineStyle(2, 0x88ffcc, 1.0);
  border.strokeRect(px, py, pw, ph);
  scene.tweens.add({
    targets: border,
    alpha: 0,
    scaleX: 1.05, scaleY: 1.05,
    duration: 350,
    onComplete: () => border.destroy(),
  });
}
```

---

## 3. 건설 진행 비주얼 (공사 중 단계)

```typescript
// plan 12의 건설 진행도(0~100%)를 시각화
class ConstructionOverlay {
  private scaffoldGfx: Phaser.GameObjects.Graphics;
  private progressBar: Phaser.GameObjects.Graphics;
  private progressLabel: Phaser.GameObjects.Text;
  private dustTimer?: Phaser.Time.TimerEvent;

  create(
    scene: Phaser.Scene,
    tileX: number, tileY: number,
    tileW: number, tileH: number
  ): void {
    const px = tileX * 32, py = tileY * 32;
    const pw = tileW * 32, ph = tileH * 32;

    // 비계(scaffolding) 그래픽
    this.scaffoldGfx = scene.add.graphics().setDepth(36);
    this.drawScaffolding(px, py, pw, ph);

    // 진행 바 (건물 위)
    this.progressBar = scene.add.graphics().setDepth(38);
    this.progressLabel = scene.add.text(px + pw / 2, py - 18, '0%', {
      fontSize: '9px', color: '#ffdd88', fontFamily: 'Courier New',
    }).setOrigin(0.5, 1).setDepth(38);

    // 공사 먼지 파티클
    this.dustTimer = scene.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => this.spawnDust(scene, px + pw / 2, py + ph / 2),
    });
  }

  update(progress: number, tileX: number, tileY: number, tileW: number): void {
    const px = tileX * 32, py = tileY * 32;
    const pw = tileW * 32;
    const barW = pw - 8;

    this.progressBar.clear();
    // 바 배경
    this.progressBar.fillStyle(0x222222, 0.8);
    this.progressBar.fillRoundedRect(px + 4, py - 12, barW, 6, 2);
    // 채움
    this.progressBar.fillStyle(0xf0c030, 1);
    this.progressBar.fillRoundedRect(px + 4, py - 12, barW * progress, 6, 2);

    this.progressLabel.setText(`${Math.round(progress * 100)}%`);

    // 진행도에 따라 비계 투명도 조정 (완성 가까울수록 흐릿하게)
    this.scaffoldGfx.setAlpha(1 - progress * 0.8);
  }

  private drawScaffolding(px: number, py: number, pw: number, ph: number): void {
    this.scaffoldGfx.lineStyle(1, 0xc8a050, 0.7);
    // 수직 기둥
    for (let x = px; x <= px + pw; x += 32) {
      this.scaffoldGfx.beginPath();
      this.scaffoldGfx.moveTo(x, py);
      this.scaffoldGfx.lineTo(x, py + ph);
      this.scaffoldGfx.strokePath();
    }
    // 수평 발판
    for (let y = py; y <= py + ph; y += 16) {
      this.scaffoldGfx.beginPath();
      this.scaffoldGfx.moveTo(px, y);
      this.scaffoldGfx.lineTo(px + pw, y);
      this.scaffoldGfx.strokePath();
    }
    // 대각 버팀대
    this.scaffoldGfx.lineStyle(1, 0xc8a050, 0.4);
    this.scaffoldGfx.beginPath();
    this.scaffoldGfx.moveTo(px, py);
    this.scaffoldGfx.lineTo(px + pw, py + ph);
    this.scaffoldGfx.strokePath();
  }

  private spawnDust(scene: Phaser.Scene, cx: number, cy: number): void {
    const emitter = scene.add.particles(
      cx + (Math.random() - 0.5) * 20,
      cy + (Math.random() - 0.5) * 20,
      '__DEFAULT', {
        speed: { min: 8, max: 25 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.35, end: 0 },
        lifespan: 600,
        quantity: 2,
        tint: 0xc8b090,
      }
    ).setDepth(37);
    emitter.explode(2);
    scene.time.delayedCall(700, () => emitter.destroy());
  }

  destroy(): void {
    this.dustTimer?.remove();
    this.scaffoldGfx.destroy();
    this.progressBar.destroy();
    this.progressLabel.destroy();
  }
}
```

---

## 4. 완공 연출

```typescript
function playConstructionCompleteEffect(
  scene: Phaser.Scene,
  tileX: number, tileY: number,
  tileW: number, tileH: number
): void {
  const px = tileX * 32, py = tileY * 32;
  const pw = tileW * 32, ph = tileH * 32;
  const cx = px + pw / 2, cy = py + ph / 2;

  // 1. 골든 링 2개 펼침
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.graphics().setDepth(55);
    const obj = { r: pw * 0.3 + i * 8 };
    scene.tweens.add({
      targets: obj,
      r: pw * 0.8 + i * 20,
      duration: 500,
      delay: i * 80,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(2 - i * 0.5, 0xf0c030, 1 - obj.r / (pw * 0.8 + i * 20));
        ring.strokeCircle(cx, cy, obj.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  // 2. 건물 위 별 파티클 폭죽
  const emitter = scene.add.particles(cx, py, '__DEFAULT', {
    speed: { min: 60, max: 140 },
    angle: { min: -130, max: -50 },
    scale: { start: 0.7, end: 0 },
    lifespan: 700,
    quantity: 20,
    tint: [0xf0c030, 0xffffff, 0x88ffaa, 0xff88cc],
    blendMode: Phaser.BlendModes.ADD,
  }).setDepth(55);
  emitter.explode(20);
  scene.time.delayedCall(800, () => emitter.destroy());

  // 3. "완공!" 텍스트 팝업
  const txt = scene.add.text(cx, py - 10, '완공!', {
    fontSize: '16px', color: '#f0c030',
    fontFamily: 'Courier New', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(56);

  scene.tweens.add({
    targets: txt,
    y: py - 36,
    scaleX: 1.3, scaleY: 1.3,
    duration: 300,
    ease: 'Back.easeOut',
    yoyo: true,
    hold: 600,
    onComplete: () => {
      scene.tweens.add({
        targets: txt,
        alpha: 0,
        duration: 300,
        onComplete: () => txt.destroy(),
      });
    },
  });

  // 4. 카메라 가벼운 진동
  scene.cameras.main.shake(120, 0.004);

  // 5. 건물 스케일 펀치
  const buildingSprite = getBuildingSprite(tileX, tileY);
  if (buildingSprite) {
    scene.tweens.add({
      targets: buildingSprite,
      scaleX: 1.06, scaleY: 1.06,
      duration: 100,
      ease: 'Back.easeOut',
      yoyo: true,
    });
  }
}
```

---

## 5. 건물 철거 이펙트

```typescript
function playDemolishEffect(
  scene: Phaser.Scene,
  tileX: number, tileY: number,
  tileW: number, tileH: number
): void {
  const px = tileX * 32, py = tileY * 32;
  const pw = tileW * 32, ph = tileH * 32;
  const cx = px + pw / 2, cy = py + ph / 2;

  // 1. 건물 흔들림
  const sprite = getBuildingSprite(tileX, tileY);
  if (sprite) {
    scene.tweens.add({
      targets: sprite,
      x: sprite.x + 3,
      duration: 60,
      yoyo: true,
      repeat: 4,
    });
  }

  // 2. 먼지·파편 파티클
  const debris = scene.add.particles(cx, cy, '__DEFAULT', {
    speed: { min: 40, max: 130 },
    angle: { min: -150, max: -30 },
    scale: { start: 0.5, end: 0 },
    lifespan: 700,
    quantity: 18,
    tint: [0xc8b090, 0x888880, 0xaaa090],
    gravity: 200,
  }).setDepth(55);
  debris.explode(18);
  scene.time.delayedCall(800, () => debris.destroy());

  // 3. 카메라 진동
  scene.cameras.main.shake(200, 0.006);
}
```

---

## 6. 건물 업그레이드 이펙트

```typescript
function playBuildingUpgradeEffect(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image
): void {
  // 황금 스캔라인 (아래→위)
  const scanLine = scene.add.graphics().setDepth(sprite.depth + 2);
  const obj = { y: sprite.y + sprite.height / 2 };

  scene.tweens.add({
    targets: obj,
    y: sprite.y - sprite.height / 2,
    duration: 500,
    ease: 'Linear',
    onUpdate: () => {
      scanLine.clear();
      scanLine.lineStyle(2, 0xf0c030, 0.7);
      scanLine.beginPath();
      scanLine.moveTo(sprite.x - sprite.width / 2 - 4, obj.y);
      scanLine.lineTo(sprite.x + sprite.width / 2 + 4, obj.y);
      scanLine.strokePath();
    },
    onComplete: () => {
      scanLine.destroy();
      // 완료 플래시
      sprite.setTint(0xffd966);
      scene.time.delayedCall(150, () => sprite.clearTint());
    },
  });
}
```

---

## 7. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 배치 격자선 | 49 | 건물 아래 |
| 배치 고스트 스프라이트 | 50 | |
| 배치 오버레이 (가능/불가) | 51 | |
| 스냅 링 / 테두리 펄스 | 52 | |
| 비계 그래픽 | 36 | 캐릭터와 유사 레이어 |
| 공사 먼지 파티클 | 37 | |
| 진행 바 + 레이블 | 38 | |
| 완공 링 / 파티클 | 55 | |
| 완공 텍스트 | 56 | |
| 업그레이드 스캔라인 | 건물+2 | |

---

## 8. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/PlacementGhost.ts` | 배치 고스트 + 격자 + 유효성 오버레이 |
| `src/fx/ConstructionOverlay.ts` | 비계 + 진행 바 + 공사 먼지 |
| `src/fx/BuildingEffects.ts` | 완공·철거·업그레이드 이펙트 |

---

## 9. 버전

`v0.72.0`
