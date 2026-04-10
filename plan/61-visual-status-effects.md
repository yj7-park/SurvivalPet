# Plan 61 — 상태이상·환경 효과 비주얼 (Visual Status Effects & Environment Overlays)

## 개요

plan 35(날씨 패널티), plan 18(광란), plan 40(캐릭터 상태 비주얼 기초)을 바탕으로  
**추위·젖음·중독·화상·냉기** 등 환경/상태이상의 캐릭터 시각 표현과  
HUD 상태 아이콘 배지를 설계한다.

---

## 1. 상태이상 종류 및 발생 조건

```typescript
type StatusEffectId =
  | 'cold'       // 추위 (겨울·블리자드 실외, 체온 감소)
  | 'freezing'   // 동결 (블리자드 장시간 노출)
  | 'wet'        // 젖음 (비·물속)
  | 'poisoned'   // 중독 (부패 음식, 독가스)
  | 'burning'    // 화상 (캠프파이어 근접 과다 or 향후 불 공격)
  | 'exhausted'  // 기진맥진 (피로 95% 이상)
  | 'starving'   // 기아 (허기 10% 이하)
  | 'bleeding'   // 출혈 (전투 피해 누적 — plan 25 보완)
```

---

## 2. 추위 (Cold / Freezing)

### 2-1. 캐릭터 숨결 파티클

```typescript
function createBreathParticles(scene: Phaser.Scene, playerSprite: Phaser.GameObjects.Sprite): void {
  // 입 위치에서 주기적으로 흰 연기 방울
  const breathTimer = scene.time.addEvent({
    delay: 2500,
    loop: true,
    callback: () => {
      if (!hasStatus('cold') && !hasStatus('freezing')) return;
      const facingDir = getPlayerFacingDir();
      const offsets: Record<Direction, { dx: number; dy: number }> = {
        down:  { dx: 2,  dy: -8  },
        up:    { dx: 2,  dy: -20 },
        left:  { dx: -6, dy: -10 },
        right: { dx: 6,  dy: -10 },
      };
      const off = offsets[facingDir];

      const emitter = scene.add.particles(
        playerSprite.x + off.dx,
        playerSprite.y + off.dy,
        'fx_pixel',
        {
          tint:    [0xd0e8ff, 0xffffff],
          speed:   { min: 6, max: 14 },
          angle:   { min: -110, max: -70 },
          scale:   { start: 1.2, end: 2.8 },
          alpha:   { start: 0.55, end: 0 },
          lifespan: { min: 400, max: 700 },
          quantity: 3, emitting: false,
          depth:   playerSprite.depth + 1
        }
      );
      emitter.explode(3);
      scene.time.delayedCall(800, () => emitter.destroy());
    }
  });
  playerSprite.setData('breathTimer', breathTimer);
}
```

### 2-2. 추위 떨림 (Shiver)

```typescript
function startShiverEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // x 방향 ±2px 빠른 oscillation (0.08s 주기)
  scene.tweens.add({
    targets: playerSprite,
    x: playerSprite.x + 2,
    duration: 80, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1,
    paused: false
  });

  // 파란 틴트 (0x88aaff) — plan 40 hit flash와 별도 tint 레이어
  playerSprite.setTint(lerpColor(0xffffff, 0x88aaff, 0.35));
}

function stopShiverEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  scene.tweens.killTweensOf(playerSprite);
  playerSprite.clearTint();
  playerSprite.setX(Math.round(playerSprite.x));  // 떨림 보정
}
```

### 2-3. 동결 효과 (Freezing)

```typescript
function applyFreezingEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 짙은 파란 틴트 + 이동 불가 표시 (알파 0.7)
  playerSprite.setTint(0x6688cc).setAlpha(0.75);

  // 얼음 결정 파티클 (캐릭터 주변 8개, 고정 위치)
  const crystalGfx = scene.add.graphics()
    .setPosition(playerSprite.x, playerSprite.y)
    .setDepth(playerSprite.depth + 1);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 18;
    const cx = Math.cos(angle) * r;
    const cy = Math.sin(angle) * r;
    crystalGfx.fillStyle(0xaaccff, 0.7);
    crystalGfx.fillTriangle(cx, cy - 4, cx - 2, cy + 3, cx + 2, cy + 3);
  }

  // 얼음 오버레이 blink (동결 중 깜빡임)
  scene.tweens.add({
    targets: crystalGfx,
    alpha: { from: 0.8, to: 0.3 },
    duration: 600, yoyo: true, repeat: -1
  });

  playerSprite.setData('freezeGraphics', crystalGfx);
}
```

---

## 3. 젖음 (Wet)

```typescript
function applyWetEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 파란 색조 밝기 보정 (어둡고 채도 높게)
  playerSprite.setTint(0x88bbdd);

  // 물방울 drip 파티클 (아래로 흘러내림, 주기 1.5s)
  const dripTimer = scene.time.addEvent({
    delay: 1500, loop: true,
    callback: () => {
      if (!hasStatus('wet')) return;
      const dx = Phaser.Math.Between(-8, 8);
      const drop = scene.add.graphics()
        .fillStyle(0x60b8f0, 0.7)
        .fillRect(0, 0, 2, 4)
        .setPosition(playerSprite.x + dx, playerSprite.y - 10)
        .setDepth(playerSprite.depth + 1);

      scene.tweens.add({
        targets: drop,
        y: drop.y + 18,
        alpha: 0, duration: 500, ease: 'Quad.easeIn',
        onComplete: () => drop.destroy()
      });
    }
  });
  playerSprite.setData('dripTimer', dripTimer);
}
```

---

## 4. 중독 (Poisoned)

```typescript
function applyPoisonEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 초록 틴트
  playerSprite.setTint(0x88cc88);

  // 초록 거품 파티클 (위로 천천히 올라감)
  const bubbleEmitter = scene.add.particles(
    playerSprite.x, playerSprite.y - 8, 'fx_pixel',
    {
      tint:    [0x40cc40, 0x60e060, 0x80ff80],
      speed:   { min: 5, max: 15 },
      angle:   { min: -120, max: -60 },
      scale:   { start: 0.8, end: 1.6 },
      alpha:   { start: 0.7, end: 0 },
      lifespan: { min: 600, max: 1200 },
      frequency: 400,
      depth:   playerSprite.depth + 1
    }
  );
  playerSprite.setData('poisonEmitter', bubbleEmitter);

  // 2s 주기로 독 피해 숫자 팝업 (plan 46 spawnDamagePopup 재사용)
  const dmgTimer = scene.time.addEvent({
    delay: 2000, loop: true,
    callback: () => {
      if (!hasStatus('poisoned')) return;
      spawnDamagePopup(playerSprite.x, playerSprite.y - 24, -3, 'poison');
    }
  });
  playerSprite.setData('poisonDmgTimer', dmgTimer);
}

// 독 피해 팝업: 초록색 "-3" 수치
// plan 46 spawnDamagePopup의 type 확장
const POPUP_COLORS = {
  normal:  '#ffffff',
  crit:    '#ffff00',
  heal:    '#40ff40',
  poison:  '#40cc40',   // 추가
};
```

---

## 5. 화상 (Burning)

```typescript
function applyBurningEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 붉은 주황 틴트
  playerSprite.setTint(0xffaa44);

  // 캐릭터 발밑 작은 불꽃 파티클
  const fireEmitter = scene.add.particles(
    playerSprite.x, playerSprite.y + 4, 'fx_pixel',
    {
      tint:    [0xff4010, 0xff8020, 0xffcc40],
      speed:   { min: 10, max: 25 },
      angle:   { min: -120, max: -60 },
      scale:   { start: 1.0, end: 0 },
      alpha:   { start: 0.9, end: 0 },
      lifespan: { min: 200, max: 400 },
      frequency: 80,
      blendMode: Phaser.BlendModes.ADD,
      depth:   playerSprite.depth - 1   // 발밑
    }
  );
  playerSprite.setData('burnEmitter', fireEmitter);

  // 화면 오렌지 vignette pulse (plan 50 ScreenShakeSystem 변형)
  scene.time.addEvent({
    delay: 1000, loop: true,
    callback: () => {
      if (!hasStatus('burning')) return;
      flashScreenVignette(0xff6020, 0.15, 300);
    }
  });
}
```

---

## 6. 기진맥진 (Exhausted)

```typescript
function applyExhaustedEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 걷기 애니 속도 절반 (frameRate 절감)
  const currentAnim = playerSprite.anims.currentAnim;
  if (currentAnim) {
    playerSprite.anims.msPerFrame = currentAnim.msPerFrame * 2;
  }

  // 캐릭터 알파 0.75 + 보라 틴트
  playerSprite.setAlpha(0.75).setTint(0xcc88cc);

  // 💤 Z 파티클 (위로 천천히)
  const zTimer = scene.time.addEvent({
    delay: 2000, loop: true,
    callback: () => {
      if (!hasStatus('exhausted')) return;
      const z = scene.add.text(
        playerSprite.x + Phaser.Math.Between(-8, 8),
        playerSprite.y - 20, 'Z',
        { fontSize: '10px', fontFamily: 'Courier New',
          color: '#aa88cc', stroke: '#000', strokeThickness: 1 }
      ).setDepth(playerSprite.depth + 2).setAlpha(0.8);

      scene.tweens.add({
        targets: z, y: z.y - 24, alpha: 0,
        duration: 1800, ease: 'Quad.easeOut',
        onComplete: () => z.destroy()
      });
    }
  });
  playerSprite.setData('zTimer', zTimer);
}
```

---

## 7. 기아 (Starving)

```typescript
function applyStarvingEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 노란 갈색 틴트 + 알파 맥박
  playerSprite.setTint(0xcc9940);

  scene.tweens.add({
    targets: playerSprite,
    alpha: { from: 1.0, to: 0.6 },
    duration: 1200, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });

  // 허기 게이지 HUD 강조 (plan 43 danger blink 트리거)
  triggerHungerGaugeBlink();

  // "배가 고파요..." 텍스트 팝업 (5s 간격)
  scene.time.addEvent({
    delay: 5000, loop: true,
    callback: () => {
      if (!hasStatus('starving')) return;
      showFloatingText(playerSprite.x, playerSprite.y - 28, '배가 고파요...', '#cc9940');
    }
  });
}
```

---

## 8. 출혈 (Bleeding)

```typescript
function applyBleedingEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  // 빨간 틴트 + 피 방울 파티클
  playerSprite.setTint(0xee4444);

  const bloodTimer = scene.time.addEvent({
    delay: 800, loop: true,
    callback: () => {
      if (!hasStatus('bleeding')) return;
      const drop = scene.add.graphics()
        .fillStyle(0xcc1010, 0.8)
        .fillCircle(0, 0, 2)
        .setPosition(
          playerSprite.x + Phaser.Math.Between(-6, 6),
          playerSprite.y + 4
        )
        .setDepth(playerSprite.depth - 1);

      scene.tweens.add({
        targets: drop,
        y: drop.y + 10, alpha: 0,
        duration: 400, ease: 'Quad.easeIn',
        onComplete: () => drop.destroy()
      });
    }
  });
  playerSprite.setData('bloodTimer', bloodTimer);
}
```

---

## 9. HUD 상태 아이콘 배지 (`StatusEffectHUD`)

plan 43 HUD 영역에 상태 아이콘을 HP/SP 게이지 아래 줄로 표시.

```typescript
const STATUS_HUD_CONFIG: Record<StatusEffectId, { icon: string; color: string; label: string }> = {
  cold:      { icon: '🥶', color: '#88aaff', label: '추위'     },
  freezing:  { icon: '🧊', color: '#aaccff', label: '동결'     },
  wet:       { icon: '💧', color: '#60b8f0', label: '젖음'     },
  poisoned:  { icon: '☠', color: '#40cc40', label: '중독'     },
  burning:   { icon: '🔥', color: '#ff8020', label: '화상'     },
  exhausted: { icon: '😩', color: '#aa88cc', label: '기진맥진' },
  starving:  { icon: '🍖', color: '#cc9940', label: '기아'     },
  bleeding:  { icon: '🩸', color: '#cc1010', label: '출혈'     },
};

function drawStatusEffectBadges(
  ctx: CanvasRenderingContext2D,
  activeStatuses: StatusEffectId[],
  startX: number, y: number
): void {
  activeStatuses.forEach((id, i) => {
    const cfg = STATUS_HUD_CONFIG[id];
    const x = startX + i * 22;

    // 배지 배경 (원형 18px)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(x + 9, y + 9, 10, 0, Math.PI * 2); ctx.fill();

    // 테두리 (상태 색상)
    ctx.strokeStyle = cfg.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + 9, y + 9, 10, 0, Math.PI * 2); ctx.stroke();

    // 아이콘 (9px emoji)
    ctx.font = '10px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cfg.icon, x + 9, y + 10);
  });
}
```

### 배지 깜빡임 (위험 상태)

```typescript
// freezing, starving, bleeding → 배지 빠른 blink (0.4s yoyo)
const DANGER_STATUSES: StatusEffectId[] = ['freezing', 'starving', 'bleeding'];
function blinkDangerBadges(badgeContainer: Phaser.GameObjects.Container): void {
  scene.tweens.add({
    targets: badgeContainer,
    alpha: { from: 1.0, to: 0.2 },
    duration: 400, yoyo: true, repeat: -1
  });
}
```

---

## 10. 상태이상 지속 시간 타이머 표시

```typescript
// 배지 위에 남은 시간 (초) 표시
function drawStatusDuration(
  ctx: CanvasRenderingContext2D,
  remainSec: number,
  badgeCX: number, badgeTY: number
): void {
  if (remainSec <= 0 || remainSec > 99) return;
  ctx.fillStyle = '#ffffff';
  ctx.font = '7px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(remainSec)}`, badgeCX, badgeTY - 2);
}
```

---

## 11. 상태이상 정리 함수 (`clearStatusEffect`)

```typescript
function clearStatusEffect(
  playerSprite: Phaser.GameObjects.Sprite,
  id: StatusEffectId
): void {
  // 각 상태별 타이머/이미터/그래픽 destroy
  const keys: Record<StatusEffectId, string[]> = {
    cold:      ['breathTimer'],
    freezing:  ['freezeGraphics'],
    wet:       ['dripTimer'],
    poisoned:  ['poisonEmitter', 'poisonDmgTimer'],
    burning:   ['burnEmitter'],
    exhausted: ['zTimer'],
    starving:  [],
    bleeding:  ['bloodTimer'],
  };
  (keys[id] ?? []).forEach(key => {
    const obj = playerSprite.getData(key);
    obj?.destroy?.(); obj?.remove?.();
    playerSprite.setData(key, null);
  });

  // 상태 해제 시 잔여 틴트/알파 복구
  playerSprite.clearTint().setAlpha(1.0);

  // 해제 파티클 (흰색 sparkle)
  const emitter = scene.add.particles(playerSprite.x, playerSprite.y - 12, 'fx_pixel', {
    tint: [0xffffff, 0xeeeeff],
    speed: { min: 20, max: 50 }, angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0 }, lifespan: 400, quantity: 6, emitting: false
  }).setDepth(playerSprite.depth + 2);
  emitter.explode(6);
  scene.time.delayedCall(500, () => emitter.destroy());
}
```

---

## 12. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 화상 발밑 불꽃 파티클 | 캐릭터 depth - 1 |
| 중독·출혈 방울 파티클 | 캐릭터 depth - 1 |
| 얼음 결정 그래픽 | 캐릭터 depth + 1 |
| 숨결 파티클 | 캐릭터 depth + 1 |
| Z 텍스트 팝업 | 캐릭터 depth + 2 |
| HUD 상태 배지 | 84 (ScrollFactor 0) |

---

## 13. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/StatusEffectVisual.ts` | 전체 상태이상 적용/해제 통합 |
| `src/systems/ColdEffect.ts` | 숨결 파티클, 떨림, 동결 얼음 |
| `src/systems/WetEffect.ts` | drip 파티클, 색조 |
| `src/systems/PoisonEffect.ts` | 거품 파티클, 수치 팝업 |
| `src/systems/BurnEffect.ts` | 불꽃 파티클, 화면 vignette |
| `src/ui/StatusEffectHUD.ts` | 배지 렌더링, 타이머, 위험 blink |

---

## 14. 버전

`v0.61.0`
