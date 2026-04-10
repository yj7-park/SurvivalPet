# Plan 67 — 무기별 공격 애니메이션 (Visual Weapon Attack Animations)

## 개요

plan 40(캐릭터 스프라이트)·plan 46(전투)에서  
근접 공격은 단일 slash 이펙트만 설계됐다.  
무기 종류(검·도끼·활·지팡이·창·단검)별로  
고유한 **공격 아크·이펙트·트레일·차징 표현**을 설계한다.

---

## 1. 무기 타입별 공격 특성

```typescript
export type WeaponType =
  | 'sword'     // 검  — 수평 가로 베기, 콤보 3타
  | 'axe'       // 도끼 — 수직 내려치기, 광역 충격파
  | 'bow'       // 활  — 차징 → 화살 발사, 관통
  | 'staff'     // 지팡이 — 에너지 구체 + 마법진
  | 'spear'     // 창  — 직선 찌르기, 긴 사거리
  | 'dagger'    // 단검 — 빠른 2연타, 백스텝
```

---

## 2. 검 (Sword) — 3콤보 베기

### 2-1. 콤보 아크 순서

```
1타: 우상→좌하 (45°) — 흰 직선 slash
2타: 좌상→우하 (반대) — 흰 직선 slash
3타: 위→아래 수직 (90°) — 황금 파워 slash + 파티클
```

```typescript
class SwordAttackAnimator {
  private comboCount = 0;
  private lastHitTime = 0;
  private readonly COMBO_WINDOW = 800;  // ms

  attack(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const now = Date.now();
    if (now - this.lastHitTime > this.COMBO_WINDOW) this.comboCount = 0;

    const combo = this.comboCount % 3;
    this.comboCount++;
    this.lastHitTime = now;

    this.playComboSlash(scene, attacker, dir, combo);
  }

  private playComboSlash(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction, combo: 0 | 1 | 2
  ): void {
    const baseX = attacker.x + DIR_OFFSETS[dir].x * 20;
    const baseY = attacker.y + DIR_OFFSETS[dir].y * 20;

    const slashDef = [
      { angle: -45, color: 0xffffff, len: 36, width: 3 },   // 1타
      { angle:  45, color: 0xffffff, len: 36, width: 3 },   // 2타
      { angle:  90, color: 0xf0c030, len: 48, width: 5 },   // 3타 피니시
    ][combo];

    // 아크 그래픽
    const gfx = scene.add.graphics().setDepth(52);
    const rad = slashDef.angle * Math.PI / 180 + DIR_BASE_ANGLES[dir];
    const arcSpan = Math.PI * 0.55;

    scene.tweens.add({
      targets: { t: 0 }, t: 1,
      duration: combo === 2 ? 200 : 130,
      ease: 'Quad.easeOut',
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.lineStyle(slashDef.width, slashDef.color, 1 - obj.t * 0.7);
        gfx.beginPath();
        gfx.arc(baseX, baseY, slashDef.len,
          rad - arcSpan * obj.t, rad + arcSpan * obj.t);
        gfx.strokePath();

        // 트레일 잔상 (이전 위치 희미한 선)
        if (obj.t > 0.2) {
          gfx.lineStyle(slashDef.width - 1, slashDef.color, (1 - obj.t) * 0.3);
          gfx.beginPath();
          gfx.arc(baseX, baseY, slashDef.len,
            rad - arcSpan * (obj.t - 0.2), rad + arcSpan * (obj.t - 0.2));
          gfx.strokePath();
        }
      },
      onComplete: () => gfx.destroy()
    });

    // 3타 피니시 파티클
    if (combo === 2) {
      const emitter = scene.add.particles(baseX, baseY, 'fx_pixel', {
        tint:    [0xf0c030, 0xffffff, 0xffee80],
        speed:   { min: 60, max: 140 },
        angle:   { min: rad*180/Math.PI - 60, max: rad*180/Math.PI + 60 },
        scale:   { start: 1.4, end: 0 },
        lifespan: 400, quantity: 10, emitting: false, depth: 53
      });
      emitter.explode(10);
      scene.time.delayedCall(500, () => emitter.destroy());

      // 카메라 흔들림 (plan 50 ScreenShakeSystem)
      ScreenShakeSystem.trigger('sword_finish');
    }
  }
}
```

---

## 3. 도끼 (Axe) — 내려치기 + 충격파

```typescript
class AxeAttackAnimator {
  attack(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite, dir: Direction): void {
    const hitX = attacker.x + DIR_OFFSETS[dir].x * 24;
    const hitY = attacker.y + DIR_OFFSETS[dir].y * 24;

    // 1. 도끼 스윙 예비동작 (캐릭터 위로 0.1s 들어올림 표현)
    scene.tweens.add({
      targets: attacker,
      y: attacker.y - 6,
      duration: 100, ease: 'Quad.easeOut',
      yoyo: true
    });

    // 2. 내려치기 아크 (굵은 수직 호, 0.18s)
    const gfx = scene.add.graphics().setDepth(52);
    const baseAngle = DIR_BASE_ANGLES[dir];
    scene.tweens.add({
      targets: { t: 0 }, t: 1, duration: 180, ease: 'Quad.easeIn',
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.lineStyle(6, 0xe06020, 1 - obj.t * 0.8);
        gfx.beginPath();
        gfx.arc(attacker.x, attacker.y, 32,
          baseAngle - Math.PI*0.3 + Math.PI*0.6*obj.t,
          baseAngle + Math.PI*0.3 * obj.t);
        gfx.strokePath();
      },
      onComplete: () => {
        gfx.destroy();
        // 3. 착지 충격파 (타원형 웨이브)
        this.playImpactWave(scene, hitX, hitY);
        // 4. 강한 카메라 흔들림
        ScreenShakeSystem.trigger('axe_hit');
      }
    });
  }

  private playImpactWave(scene: Phaser.Scene, x: number, y: number): void {
    const gfx = scene.add.graphics().setDepth(51);
    scene.tweens.add({
      targets: { r: 4, a: 0.8 }, r: 56, a: 0,
      duration: 350, ease: 'Quad.easeOut',
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.lineStyle(3, 0xe06020, obj.a);
        gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.6);
      },
      onComplete: () => gfx.destroy()
    });

    // 파편 파티클 (돌/흙 느낌)
    const emitter = scene.add.particles(x, y, 'fx_pixel', {
      tint: [0x808070, 0xa09060, 0xd0c080],
      speed: { min: 40, max: 100 },
      angle: { min: -160, max: -20 },
      gravityY: 200,
      scale: { start: 1.2, end: 0 },
      lifespan: 400, quantity: 8, emitting: false, depth: 53
    });
    emitter.explode(8);
    scene.time.delayedCall(500, () => emitter.destroy());
  }
}
```

---

## 4. 활 (Bow) — 차징·발사

```typescript
class BowAttackAnimator {
  private chargeStart = 0;
  private chargeGfx: Phaser.GameObjects.Graphics | null = null;
  private readonly MAX_CHARGE = 1200;   // ms

  startCharge(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite): void {
    this.chargeStart = Date.now();
    this.chargeGfx = scene.add.graphics().setDepth(52);

    // 차징 중 시위 당김 표현 (활 주변 에너지 수렴)
    scene.time.addEvent({
      delay: 50, repeat: -1,
      callback: () => {
        if (!this.chargeGfx) return;
        const ratio = Math.min(1, (Date.now() - this.chargeStart) / this.MAX_CHARGE);
        this.chargeGfx.clear();

        // 에너지 원 수렴 (크게 → 작게)
        const r = 32 - ratio * 20;
        this.chargeGfx.lineStyle(2, 0x80d0ff, ratio * 0.6);
        this.chargeGfx.strokeCircle(attacker.x, attighter.y - 8, r);

        // 풀차징 달성 시 황금 글로우
        if (ratio >= 1.0) {
          this.chargeGfx.lineStyle(3, 0xf0c030, 0.8);
          this.chargeGfx.strokeCircle(attacker.x, attacker.y - 8, 12);
        }
      }
    });
  }

  release(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const charge = Math.min(1.0, (Date.now() - this.chargeStart) / this.MAX_CHARGE);
    this.chargeGfx?.destroy(); this.chargeGfx = null;

    // 화살 생성 (plan 46 확장 — 차징 배율 반영)
    const arrow = createArrowProjectile(scene, attacker, dir, {
      speedMultiplier:  1.0 + charge * 0.8,
      damageMultiplier: 1.0 + charge * 1.5,
      piercing:         charge >= 0.9,    // 풀차징 시 관통
    });

    // 발사 섬광 (시위 위치)
    const flash = scene.add.graphics()
      .lineStyle(2, 0xffffff, 0.9)
      .setDepth(53);
    flash.strokeCircle(attacker.x, attacker.y - 8, 8);
    scene.tweens.add({
      targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 150, onComplete: () => flash.destroy()
    });

    // 풀차징 발사 시 충격파 링
    if (charge >= 0.9) {
      const shockwave = scene.add.graphics().setDepth(53);
      scene.tweens.add({
        targets: { r: 8, a: 0.7 }, r: 40, a: 0,
        duration: 250, ease: 'Quad.easeOut',
        onUpdate: (tw, obj) => {
          shockwave.clear();
          shockwave.lineStyle(2, 0xf0c030, obj.a);
          shockwave.strokeCircle(attacker.x, attacker.y - 8, obj.r);
        },
        onComplete: () => shockwave.destroy()
      });
    }
  }
}
```

---

## 5. 지팡이 (Staff) — 마법진 + 에너지 구체

```typescript
class StaffAttackAnimator {
  attack(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite, dir: Direction): void {
    const castX = attacker.x + DIR_OFFSETS[dir].x * 28;
    const castY = attacker.y + DIR_OFFSETS[dir].y * 28;

    // 1. 마법진 (육각형 패턴 + 회전)
    this.drawMagicCircle(scene, castX, castY);

    // 2. 에너지 구체 발사 (plan 46 arrow와 유사, 구형 이미지)
    const orb = scene.add.graphics()
      .fillStyle(0x8040ff, 1.0)
      .fillCircle(0, 0, 6)
      .setPosition(attacker.x, attacker.y - 8)
      .setDepth(52);
    // 구체 글로우
    const orbGlow = scene.add.graphics()
      .fillStyle(0xc080ff, 0.3)
      .fillCircle(0, 0, 12)
      .setPosition(attacker.x, attacker.y - 8)
      .setDepth(51);

    const vx = DIR_OFFSETS[dir].x * 200;
    const vy = DIR_OFFSETS[dir].y * 200;

    scene.tweens.add({
      targets: { t: 0 }, t: 1,
      duration: 600,
      onUpdate: (tw, obj) => {
        orb.setPosition(attacker.x + vx*obj.t, attacker.y - 8 + vy*obj.t);
        orbGlow.setPosition(orb.x, orb.y);
        orb.setAngle(obj.t * 360);   // 회전
      },
      onComplete: () => {
        orb.destroy(); orbGlow.destroy();
        this.playOrbImpact(scene, orb.x, orb.y);
      }
    });
  }

  private drawMagicCircle(scene: Phaser.Scene, x: number, y: number): void {
    const gfx = scene.add.graphics().setDepth(50);
    let angle = 0;

    const update = scene.time.addEvent({
      delay: 16, repeat: 30,
      callback: () => {
        angle += 6;
        gfx.clear();
        gfx.lineStyle(1, 0x8040ff, 0.7);
        // 외부 원
        gfx.strokeCircle(x, y, 24);
        // 내부 육각형 (회전)
        gfx.lineStyle(1, 0xc080ff, 0.5);
        const hex: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const a = (angle + i * 60) * Math.PI / 180;
          hex.push([x + Math.cos(a)*16, y + Math.sin(a)*10]);
        }
        gfx.beginPath();
        gfx.moveTo(hex[0][0], hex[0][1]);
        hex.slice(1).forEach(p => gfx.lineTo(p[0], p[1]));
        gfx.closePath(); gfx.strokePath();
      },
      callbackScope: this
    });

    scene.time.delayedCall(500, () => {
      update.remove();
      scene.tweens.add({ targets: gfx, alpha: 0, duration: 200,
        onComplete: () => gfx.destroy() });
    });
  }

  private playOrbImpact(scene: Phaser.Scene, x: number, y: number): void {
    const emitter = scene.add.particles(x, y, 'fx_pixel', {
      tint: [0x8040ff, 0xc080ff, 0xffffff],
      speed: { min: 50, max: 120 }, angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 }, lifespan: 400,
      quantity: 12, emitting: false,
      blendMode: Phaser.BlendModes.ADD, depth: 53
    });
    emitter.explode(12);
    scene.time.delayedCall(500, () => emitter.destroy());
  }
}
```

---

## 6. 창 (Spear) — 직선 찌르기

```typescript
class SpearAttackAnimator {
  attack(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite, dir: Direction): void {
    const reach = 48;  // 긴 사거리
    const endX = attacker.x + DIR_OFFSETS[dir].x * reach;
    const endY = attacker.y + DIR_OFFSETS[dir].y * reach;

    // 1. 창 선 (시작→끝 빠르게 뻗고 돌아옴)
    const gfx = scene.add.graphics().setDepth(52);
    scene.tweens.add({
      targets: { t: 0 }, t: 1, duration: 100, ease: 'Quad.easeOut',
      yoyo: true, hold: 80,
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.lineStyle(3, 0xa0c0d0, 1 - obj.t * 0.3);
        gfx.lineBetween(
          attacker.x, attacker.y - 4,
          attacker.x + DIR_OFFSETS[dir].x * reach * obj.t,
          attacker.y - 4 + DIR_OFFSETS[dir].y * reach * obj.t
        );
        // 창끝 반짝임
        if (obj.t > 0.7) {
          gfx.fillStyle(0xffffff, (obj.t - 0.7) / 0.3);
          gfx.fillCircle(endX, endY, 4);
        }
      },
      onComplete: () => gfx.destroy()
    });

    // 2. 찌르기 잔상 (얇은 선 trail 3개)
    for (let i = 1; i <= 3; i++) {
      scene.time.delayedCall(i * 15, () => {
        const trail = scene.add.graphics()
          .lineStyle(1, 0xa0c0d0, 0.2)
          .setDepth(51);
        trail.lineBetween(
          attacker.x - DIR_OFFSETS[dir].x * i * 4,
          attacker.y - 4 - DIR_OFFSETS[dir].y * i * 4,
          endX - DIR_OFFSETS[dir].x * i * 4,
          endY - DIR_OFFSETS[dir].y * i * 4
        );
        scene.tweens.add({ targets: trail, alpha: 0, duration: 150,
          onComplete: () => trail.destroy() });
      });
    }
  }
}
```

---

## 7. 단검 (Dagger) — 2연타 + 백스텝

```typescript
class DaggerAttackAnimator {
  attack(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite, dir: Direction): void {
    // 1타: 빠른 slash (0.08s)
    this.quickSlash(scene, attacker, dir, 0, 0xffffff);

    // 2타: 50ms 뒤 크로스 slash
    scene.time.delayedCall(100, () => {
      this.quickSlash(scene, attacker, dir, 90, 0xffffff);

      // 2타 후 백스텝 (뒤로 16px 빠르게 이동)
      const backDir = OPPOSITE_DIR[dir];
      scene.tweens.add({
        targets: attacker,
        x: attacker.x + DIR_OFFSETS[backDir].x * 16,
        y: attacker.y + DIR_OFFSETS[backDir].y * 16,
        duration: 80, ease: 'Quad.easeOut',
        onComplete: () => {
          // 복귀
          scene.tweens.add({ targets: attacker,
            x: attacker.x - DIR_OFFSETS[backDir].x * 16,
            y: attacker.y - DIR_OFFSETS[backDir].y * 16,
            duration: 150 });
        }
      });
    });
  }

  private quickSlash(
    scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite,
    dir: Direction, angleOffset: number, color: number
  ): void {
    const gfx = scene.add.graphics().setDepth(52);
    const base = DIR_BASE_ANGLES[dir] + angleOffset * Math.PI / 180;
    scene.tweens.add({
      targets: { t: 0 }, t: 1, duration: 80, ease: 'Linear',
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.lineStyle(2, color, 1 - obj.t);
        gfx.beginPath();
        gfx.arc(attacker.x, attacker.y, 24,
          base - 0.8 + 1.6 * obj.t, base + 0.8 * obj.t);
        gfx.strokePath();
      },
      onComplete: () => gfx.destroy()
    });
  }
}
```

---

## 8. 공통: 무기 트레일 시스템 (`WeaponTrailRenderer`)

장착 무기 아이콘이 공격 시 짧은 색상 궤적을 남김:

```typescript
class WeaponTrailRenderer {
  private trail: { x: number; y: number; t: number }[] = [];

  update(weaponX: number, weaponY: number, isAttacking: boolean, gfx: Phaser.GameObjects.Graphics): void {
    if (!isAttacking) { this.trail = []; gfx.clear(); return; }

    this.trail.push({ x: weaponX, y: weaponY, t: Date.now() });
    const cutoff = Date.now() - 120;
    this.trail = this.trail.filter(p => p.t > cutoff);

    gfx.clear();
    this.trail.forEach((p, i, arr) => {
      const alpha = (i / arr.length) * 0.6;
      const w = 2 * (i / arr.length);
      gfx.lineStyle(w, weaponTrailColor, alpha);
      if (i > 0) gfx.lineBetween(arr[i-1].x, arr[i-1].y, p.x, p.y);
    });
  }
}
```

---

## 9. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 충격파 링 | 51 |
| 공격 아크 그래픽 | 52 |
| 파티클 | 53 |
| 마법진 | 50 |
| 무기 트레일 | 36 |

---

## 10. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/SwordAttackAnimator.ts` | 3콤보 아크, 트레일 |
| `src/systems/AxeAttackAnimator.ts` | 수직 내려치기, 충격파 |
| `src/systems/BowAttackAnimator.ts` | 차징 수렴, 발사 섬광 |
| `src/systems/StaffAttackAnimator.ts` | 마법진, 에너지 구체 |
| `src/systems/SpearAttackAnimator.ts` | 직선 찌르기, 잔상 |
| `src/systems/DaggerAttackAnimator.ts` | 2연타, 백스텝 |
| `src/systems/WeaponTrailRenderer.ts` | 공통 트레일 |
| `src/systems/WeaponAttackSystem.ts` | 무기 타입별 분기 통합 |

---

## 11. 버전

`v0.67.0`
