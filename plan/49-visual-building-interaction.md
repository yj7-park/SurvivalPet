# 설계 49 — 건설·상호작용·회복 비주얼

> **전제 조건**: 01~48 단계 완료 상태.
> plan 02(건설), plan 11(상호작용 프로그레스 바), plan 12(건설 고도화),
> plan 22(내구도), plan 23(수면), plan 24(허기), plan 31(실내/지붕)을
> 기반으로 상호작용 전반의 시각 연출을 확정한다.

---

## 1. 이번 단계 목표

1. **건설 진행 & 완성 이펙트** — 건설 중 망치질 파티클, 완성 축하 연출
2. **프로그레스 바 비주얼** — 벌목·채굴·낚시·건설 진행 바 외형 통일
3. **실내 조명 분위기** — 지붕 아래 따뜻한 조명 오버레이, 지붕 투명화
4. **음식 섭취 & 회복 이펙트** — 먹을 때 파티클, 체력 회복 시각
5. **숙련도 레벨업 이펙트** — XP 획득 팝업, 레벨업 팡파레
6. **모닥불 불꽃 파티클** — 연기·불꽃·잔불 상세 파티클

---

## 2. 건설 진행 & 완성 이펙트

### 2-1. 건설 중 파티클

```typescript
// 건설 진행 중 (plan 02 빌드 시간 동안) 목재/석재 파편 파티클
function spawnBuildParticles(
  x: number, y: number,
  material: 'wood' | 'stone',
  progress: number,   // 0~1
): void {
  // 진행도에 따라 파티클 강도 증가
  const qty = Math.floor(progress * 3) + 1;

  const tints = material === 'wood'
    ? [0xc8884a, 0xa06030, 0xe0aa6a]
    : [0x909090, 0x707070, 0xb0b0b0];

  for (let i = 0; i < qty; i++) {
    const chip = scene.add.rectangle(
      x + Phaser.Math.Between(-8, 8),
      y + Phaser.Math.Between(-8, 8),
      Phaser.Math.Between(2, 5),
      Phaser.Math.Between(2, 4),
      Phaser.Utils.Array.GetRandom(tints),
    );
    scene.tweens.add({
      targets: chip,
      x: chip.x + Phaser.Math.Between(-20, 20),
      y: chip.y - Phaser.Math.Between(10, 25),
      alpha: 0, angle: Phaser.Math.Between(-180, 180),
      duration: Phaser.Math.Between(300, 500),
      ease: 'Quad.easeOut',
      onComplete: () => chip.destroy(),
    });
  }

  // 망치질 효과음 시각 (impact ring)
  const ring = scene.add.graphics();
  ring.lineStyle(1, material === 'wood' ? 0xc8884a : 0x909090, 0.6);
  ring.strokeCircle(x, y, 4);
  scene.tweens.add({
    targets: ring, scale: 3, alpha: 0,
    duration: 250, ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });
}
```

### 2-2. 건설 완성 이펙트

```typescript
function playBuildCompleteEffect(x: number, y: number, material: 'wood' | 'stone'): void {
  // 1. 골든 별 파티클 8개 방사형
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const star  = scene.add.star(x, y, 4, 2, 5, 0xffd060).setAlpha(0.9);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * 35,
      y: y + Math.sin(angle) * 35 - 10,
      alpha: 0, scale: 0,
      duration: 500, ease: 'Quad.easeOut',
      onComplete: () => star.destroy(),
    });
  }

  // 2. 중앙 골든 링 팽창
  const ring = scene.add.graphics();
  ring.lineStyle(2, 0xffd060, 0.8);
  ring.strokeCircle(x, y, 4);
  scene.tweens.add({
    targets: ring, scale: 5, alpha: 0,
    duration: 400, ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });

  // 3. "완성!" 텍스트 팝업
  const text = scene.add.text(x, y - 20, '건설 완료!', {
    fontSize: '11px', fontFamily: 'Courier New',
    color: '#ffd060', stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(80);
  scene.tweens.add({
    targets: text, y: text.y - 20, alpha: 0,
    duration: 800, ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });

  // 4. 건물 스프라이트 스케일 펀치 (1.2→1.0, 0.2초)
  const structSprite = getStructSprite(x, y);
  if (structSprite) {
    scene.tweens.add({
      targets: structSprite, scale: 1.2,
      duration: 100, yoyo: true, ease: 'Quad.easeOut',
    });
  }
}
```

### 2-3. 건설 반투명 프리뷰 (plan 42 확장)

```typescript
// 배치 가능: 초록 반투명 + 건설 격자선
previewSprite.setTint(0x88ff88).setAlpha(0.55);

// 격자선 오버레이 (타일 경계 표시)
const gridGfx = scene.add.graphics().setDepth(previewSprite.depth + 1);
gridGfx.lineStyle(1, 0x44cc44, 0.4);
for (let dx = 0; dx <= tileW; dx++) {
  gridGfx.lineBetween(px + dx*32, py, px + dx*32, py + tileH*32);
}
for (let dy = 0; dy <= tileH; dy++) {
  gridGfx.lineBetween(px, py + dy*32, px + tileW*32, py + dy*32);
}
```

---

## 3. 프로그레스 바 비주얼

### 3-1. 통일된 프로그레스 바 외형

모든 상호작용(벌목·채굴·낚시·건설·요리·제작)에 공통 사용:

```typescript
// 캐릭터 머리 위 (-40px) 에 고정
interface ProgressBarOptions {
  width:    number;   // 기본 48px
  color:    number;   // 작업별 색상
  icon:     string;   // 좌측 아이콘 이모지
  label?:   string;   // 작업명 (선택)
}

const PROGRESS_CONFIGS: Record<ActionType, ProgressBarOptions> = {
  chop:    { width: 48, color: 0xa06030, icon: '🪓' },
  mine:    { width: 48, color: 0x808080, icon: '⛏' },
  fish:    { width: 48, color: 0x4080c0, icon: '🎣' },
  build:   { width: 56, color: 0xc8a030, icon: '🔨' },
  cook:    { width: 48, color: 0xe06020, icon: '🍳' },
  craft:   { width: 48, color: 0x8060c0, icon: '⚒' },
  sleep:   { width: 48, color: 0x4060c0, icon: '💤' },
};

function drawProgressBar(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number,
  progress: number,   // 0~1
  opts: ProgressBarOptions,
): void {
  const { width: w, color } = opts;
  const h = 6;

  // 배경 캡슐
  gfx.fillStyle(0x0a0806, 0.85);
  gfx.fillRoundedRect(x - w/2, y, w, h, 3);

  // 진행 채움 (그라디언트 근사: 2단계)
  const fw = Math.floor(w * progress);
  if (fw > 0) {
    gfx.fillStyle(color, 0.5);
    gfx.fillRoundedRect(x - w/2, y, fw, h, 3);
    gfx.fillStyle(color, 1.0);
    gfx.fillRoundedRect(x - w/2, y + 1, fw, h - 3, 2);
    // 반짝이는 선두 (진행 선단에 밝은 점)
    gfx.fillStyle(0xffffff, 0.6);
    gfx.fillRect(x - w/2 + fw - 2, y + 1, 2, h - 3);
  }

  // 테두리
  gfx.lineStyle(1, 0x3a2a14, 0.8);
  gfx.strokeRoundedRect(x - w/2, y, w, h, 3);
}
```

### 3-2. 취소 시 이펙트

```typescript
// 상호작용 도중 취소(이동 or ESC):
// 프로그레스 바가 빠르게 오른→왼으로 감소 (0.15초)
scene.tweens.add({
  targets: progressFill, scaleX: 0,
  duration: 150, ease: 'Quad.easeIn',
  onComplete: () => hideProgressBar(),
});
// + 빨간 X 아이콘 순간 표시
const xMark = scene.add.text(x, y - 45, '✕', {
  fontSize: '14px', color: '#ff4444', stroke: '#000000', strokeThickness: 2,
}).setOrigin(0.5);
scene.tweens.add({
  targets: xMark, y: xMark.y - 10, alpha: 0, duration: 300,
  onComplete: () => xMark.destroy(),
});
```

---

## 4. 실내 조명 & 지붕 투명화

### 4-1. 지붕 투명화 (플레이어 진입 시)

```typescript
// plan 31: isIndoor 판정 시 지붕 스프라이트 페이드
function setRoofTransparency(roofSprite: Phaser.GameObjects.Image, indoor: boolean): void {
  scene.tweens.add({
    targets: roofSprite,
    alpha: indoor ? 0.25 : 1.0,   // 진입 시 25% 투명 (구조는 보임)
    duration: 200,
    ease: 'Quad.easeOut',
  });
  // 지붕 틴트: 실내 진입 시 약간 청회색 (내부 시점)
  if (indoor) {
    roofSprite.setTint(0x8899aa);
  } else {
    roofSprite.clearTint();
  }
}
```

### 4-2. 실내 따뜻한 조명 오버레이

```typescript
// 실내 공간에 황갈색 따뜻한 오버레이 (모닥불·조명 분위기)
// 지붕 영역 내부에만 적용 (RoofSystem.roofSet 타일 좌표 기반)

function drawIndoorWarmOverlay(roofTiles: Set<string>): void {
  const overlayGfx = scene.add.graphics().setScrollFactor(1).setDepth(3.5);

  roofTiles.forEach(key => {
    const [tx, ty] = key.split('_').map(Number);
    const px = tx * 32, py = ty * 32;

    // 황갈색 반투명 사각형
    overlayGfx.fillStyle(0xffcc88, 0.06);
    overlayGfx.fillRect(px, py, 32, 32);
  });
}

// 모닥불이 실내에 있으면 오버레이 강도 증가
function updateIndoorLighting(hasCampfire: boolean): void {
  const alpha = hasCampfire ? 0.10 : 0.06;
  overlayGfx.setAlpha(alpha);  // 모닥불 있으면 더 따뜻하게
}
```

### 4-3. 실내/실외 경계 그림자

```typescript
// 지붕 안쪽 테두리에 내부 그림자 (깊이감)
function drawRoofInnerShadow(gfx: Phaser.GameObjects.Graphics, roofBounds: Rect): void {
  gfx.fillStyle(0x000000, 0.12);
  // 상단 그림자
  gfx.fillRect(roofBounds.x, roofBounds.y, roofBounds.w, 8);
  // 좌측
  gfx.fillRect(roofBounds.x, roofBounds.y, 8, roofBounds.h);
  // 우측
  gfx.fillRect(roofBounds.x + roofBounds.w - 8, roofBounds.y, 8, roofBounds.h);
}
```

---

## 5. 음식 섭취 & 회복 이펙트

### 5-1. 음식 섭취 파티클

```typescript
function playEatEffect(x: number, y: number, food: FoodItem): void {
  // 1. 음식 아이콘 팝업 (크게 나타났다 사라짐)
  const icon = scene.add.image(x, y - 24, food.spriteKey).setScale(1.5);
  scene.tweens.add({
    targets: icon,
    y: icon.y - 16, scale: 0, alpha: 0,
    duration: 600, ease: 'Back.easeIn',
    onComplete: () => icon.destroy(),
  });

  // 2. 허기 회복량 팝업 (주황색)
  spawnDamagePopup(x, y, {
    value: food.hungerRestore, isCrit: false, isHeal: true,
  });

  // 3. 하트 파티클 (회복량이 많을수록 많이)
  const heartCount = Math.ceil(food.hungerRestore / 10);
  for (let i = 0; i < heartCount; i++) {
    scene.time.delayedCall(i * 60, () => {
      const heart = scene.add.text(
        x + Phaser.Math.Between(-12, 12),
        y - Phaser.Math.Between(10, 20), '♥', {
          fontSize: '10px', color: '#ff9944',
          stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5);
      scene.tweens.add({
        targets: heart, y: heart.y - 20, alpha: 0,
        duration: 700, ease: 'Quad.easeOut',
        onComplete: () => heart.destroy(),
      });
    });
  }
}
```

### 5-2. HP 회복 이펙트

```typescript
function playHealEffect(x: number, y: number, amount: number): void {
  // 초록 + 기호 팝업 (크리티컬과 구분된 초록)
  spawnDamagePopup(x, y, { value: amount, isCrit: false, isHeal: true });

  // 초록 파티클 위로 퍼짐 (자연 회복 느낌)
  for (let i = 0; i < 4; i++) {
    const dot = scene.add.circle(
      x + Phaser.Math.Between(-10, 10),
      y + Phaser.Math.Between(-5, 5),
      2, 0x44cc66,
    );
    scene.tweens.add({
      targets: dot,
      y: dot.y - Phaser.Math.Between(15, 30),
      alpha: 0, scale: 0,
      duration: Phaser.Math.Between(500, 800),
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}
```

### 5-3. 식중독 이펙트

```typescript
function playFoodPoisonEffect(x: number, y: number): void {
  // 보라/초록빛 구토 파티클
  const colors = [0x88cc44, 0x44aa22, 0xaacc00];
  for (let i = 0; i < 6; i++) {
    const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 4),
      Phaser.Utils.Array.GetRandom(colors));
    scene.tweens.add({
      targets: dot,
      x: dot.x + Phaser.Math.Between(-25, 25),
      y: dot.y + Phaser.Math.Between(10, 30),
      alpha: 0,
      duration: Phaser.Math.Between(400, 700),
      onComplete: () => dot.destroy(),
    });
  }

  // "식중독!" 보라 텍스트
  const txt = scene.add.text(x, y - 30, '🤢 식중독!', {
    fontSize: '11px', fontFamily: 'Courier New',
    color: '#aacc44', stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(80);
  scene.tweens.add({
    targets: txt, y: txt.y - 16, alpha: 0, duration: 1200,
    onComplete: () => txt.destroy(),
  });
}
```

---

## 6. 숙련도 레벨업 이펙트

### 6-1. XP 획득 팝업

```typescript
function showXpGain(x: number, y: number, skill: SkillType, xp: number): void {
  const skillColors: Record<SkillType, string> = {
    woodcutting: '#a06030',
    mining:      '#909090',
    fishing:     '#4080c0',
    building:    '#c8a030',
    cooking:     '#e06020',
    crafting:    '#8060c0',
    combat:      '#cc3030',
    farming:     '#40a030',
  };

  const text = scene.add.text(x, y - 28, `+${xp} ${skill}`, {
    fontSize: '10px', fontFamily: 'Courier New',
    color: skillColors[skill],
    stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(80).setAlpha(0.85);

  scene.tweens.add({
    targets: text, y: text.y - 18, alpha: 0,
    duration: 900, ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });
}
```

### 6-2. 레벨업 팡파레

```typescript
function playLevelUpEffect(x: number, y: number, skill: SkillType, newLevel: number): void {
  // 1. 황금 링 2개 팽창 (시차 0.15초)
  [0, 150].forEach(delay => {
    const ring = scene.add.graphics().setDepth(85);
    ring.lineStyle(2, 0xffd060, 0.9);
    ring.strokeCircle(x, y, 8);
    scene.time.delayedCall(delay, () => {
      scene.tweens.add({
        targets: ring, scale: 4, alpha: 0,
        duration: 500, ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    });
  });

  // 2. 별 파티클 12개 방사형
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const star  = scene.add.star(x, y, 4, 2, 6, 0xffd060);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * 50,
      y: y + Math.sin(angle) * 50,
      alpha: 0, scale: 0, angle: 360,
      duration: 700, ease: 'Quad.easeOut',
      onComplete: () => star.destroy(),
    });
  }

  // 3. 레벨업 텍스트 (크게)
  const lvText = scene.add.text(x, y - 30,
    `⬆ ${skill} Lv.${newLevel}!`, {
      fontSize: '14px', fontFamily: 'Courier New',
      color: '#ffd060', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(90).setScale(0);

  scene.tweens.add({
    targets: lvText, scale: 1, y: lvText.y - 10,
    duration: 300, ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: lvText, alpha: 0,
    duration: 600, delay: 1200, ease: 'Quad.easeIn',
    onComplete: () => lvText.destroy(),
  });

  // 4. 화면 상단 토스트 (plan 37 NotifySystem 연동)
  notifySystem.show(`⬆ ${skill} Lv.${newLevel} 달성!`, 'success');
}
```

---

## 7. 모닥불 불꽃 파티클 상세

### 7-1. 불꽃 파티클

```typescript
function createCampfireEmitters(x: number, y: number): CampfireEmitters {
  // 불꽃 (메인, 위로 솟음)
  const flame = scene.add.particles(x, y - 4, 'fx_raindrop', {
    tint: [0xff4400, 0xff8800, 0xffcc00, 0xff2200],
    scale: { start: 1.4, end: 0 },
    alpha: { start: 0.9, end: 0 },
    speedY: { min: -80, max: -50 },
    speedX: { min: -15, max: 15 },
    lifespan: { min: 300, max: 500 },
    quantity: 2, frequency: 40,
    blendMode: Phaser.BlendModes.ADD,
  });

  // 불씨 (작은 점, 더 높이 올라감)
  const ember = scene.add.particles(x, y - 4, 'fx_spark', {
    tint: [0xff8800, 0xffaa00],
    scale: { start: 0.6, end: 0 },
    alpha: { start: 1, end: 0 },
    speedY: { min: -120, max: -60 },
    speedX: { min: -25, max: 25 },
    gravityY: -20,
    lifespan: { min: 600, max: 1000 },
    quantity: 1, frequency: 120,
    blendMode: Phaser.BlendModes.ADD,
  });

  // 연기 (회백색, 느리게 위로)
  const smoke = scene.add.particles(x, y - 12, 'fx_dust', {
    tint: [0x888880, 0xa0a098, 0x707068],
    scale: { start: 0.8, end: 2.5 },
    alpha: { start: 0.35, end: 0 },
    speedY: { min: -30, max: -15 },
    speedX: { min: -8,  max: 8 },
    lifespan: { min: 1200, max: 2000 },
    quantity: 1, frequency: 200,
  });

  return { flame, ember, smoke };
}
```

### 7-2. 연료 잔량에 따른 파티클 강도

```typescript
function updateCampfireIntensity(emitters: CampfireEmitters, fuelRatio: number): void {
  // fuelRatio: 0~1
  if (fuelRatio > 0.8) {
    emitters.flame.setQuantity(3); emitters.ember.setQuantity(2);
    emitters.smoke.setQuantity(1);
  } else if (fuelRatio > 0.5) {
    emitters.flame.setQuantity(2); emitters.ember.setQuantity(1);
    emitters.smoke.setQuantity(1);
  } else if (fuelRatio > 0.2) {
    emitters.flame.setQuantity(1); emitters.ember.setQuantity(0);
    emitters.smoke.setQuantity(2);  // 약해지며 연기 증가
  } else {
    // 꺼지기 직전: 깜빡이는 작은 불꽃
    emitters.flame.setQuantity(1);
    emitters.flame.setFrequency(Phaser.Math.Between(80, 200));  // 불규칙
    emitters.smoke.setQuantity(3);
  }
}
```

### 7-3. 소화 연기 폭발

```typescript
// 빗물에 꺼질 때: 흰 연기 급격히 방출
function playCampfireExtinguish(x: number, y: number): void {
  for (let i = 0; i < 12; i++) {
    const puff = scene.add.circle(x, y, Phaser.Math.Between(3, 8), 0xddddcc);
    scene.tweens.add({
      targets: puff,
      x: puff.x + Phaser.Math.Between(-30, 30),
      y: puff.y - Phaser.Math.Between(20, 50),
      scale: { from: 1, to: 3 }, alpha: 0,
      duration: Phaser.Math.Between(600, 1000),
      ease: 'Quad.easeOut',
      onComplete: () => puff.destroy(),
    });
  }
}
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/rendering/BuildRenderer.ts` | 신규: 건설 파티클, 완성 이펙트, 격자 미리보기 |
| `src/rendering/ProgressBarRenderer.ts` | 신규: 통일된 프로그레스 바 드로잉 |
| `src/rendering/IndoorRenderer.ts` | 신규: 지붕 투명화, 따뜻한 오버레이, 내부 그림자 |
| `src/rendering/FeedbackRenderer.ts` | 신규: 섭취·회복·식중독·레벨업 이펙트 통합 |
| `src/systems/CampfireSystem.ts` | 파티클 이미터 관리, 연료 강도 연동 |
| `src/scenes/GameScene.ts` | 각 Renderer 통합, 이벤트 훅 연결 |

---

## 9. 확정 규칙

- 프로그레스 바 선두 반짝이는 점: 항상 최전단(채움 우측 끝)에 위치
- 건설 파티클은 건설 중 1초마다 1회 (매 프레임 아님 — 과도한 파티클 방지)
- 지붕 투명화: 플레이어만 실내일 때 → 해당 지붕만 투명화 (멀티 시 다른 플레이어 지붕은 유지)
- 모닥불 파티클: ADD 블렌드 (불꽃·불씨), 일반 블렌드 (연기)
- 레벨업 팡파레: 동시에 여러 레벨업 시 0.3초 간격으로 스태거
- XP 팝업: 같은 위치에 0.2초 내 연속 발생 시 누적 표시 (`+8 woodcutting` × 2 → `+16`)
- 소화 연기 이미터: 폭발 후 자동 정지 (1회성 — `lifespan` 이후 자동 소멸)
