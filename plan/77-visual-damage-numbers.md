# Plan 77 — 데미지 숫자 및 전투 피드백 텍스트

## 목표
전투 중 플레이어·적이 받는 데미지, 치유, 크리티컬, 상태이상 등을
화면에 팝업 텍스트로 표시해 전투 피드백을 강화한다.

## 버전
`v0.77.0`

## 대상 파일
- `src/rendering/DamageNumberRenderer.ts` (신규)
- `src/rendering/FeedbackRenderer.ts` (훅 연결)

---

## 1. 타입 및 설정

```typescript
// src/rendering/DamageNumberRenderer.ts

export type DamageType =
  | 'normal'    // 일반 공격
  | 'crit'      // 크리티컬
  | 'heal'      // 치유
  | 'poison'    // 독
  | 'fire'      // 화염
  | 'ice'       // 냉기
  | 'miss'      // 회피
  | 'block'     // 방어
  | 'exp';      // 경험치 획득

const DMG_STYLE: Record<DamageType, {
  color: string; stroke: string; size: number; prefix: string;
}> = {
  normal: { color: '#ffffff', stroke: '#222222', size: 16, prefix: ''   },
  crit:   { color: '#ffdd22', stroke: '#884400', size: 22, prefix: '!!'},
  heal:   { color: '#44ff88', stroke: '#006622', size: 15, prefix: '+' },
  poison: { color: '#88ff44', stroke: '#224400', size: 14, prefix: ''  },
  fire:   { color: '#ff6622', stroke: '#441100', size: 15, prefix: '🔥'},
  ice:    { color: '#88ddff', stroke: '#003355', size: 14, prefix: '❄' },
  miss:   { color: '#aaaaaa', stroke: '#333333', size: 13, prefix: ''  },
  block:  { color: '#8888ff', stroke: '#111144', size: 13, prefix: ''  },
  exp:    { color: '#ffcc44', stroke: '#553300', size: 12, prefix: 'EXP+'},
};
```

---

## 2. 오브젝트 풀 기반 DamageNumberRenderer

```typescript
const POOL_SIZE = 40;  // 동시 최대 팝업 수

interface PoolEntry {
  text: Phaser.GameObjects.Text;
  tween: Phaser.Tweens.Tween | null;
  inUse: boolean;
}

export class DamageNumberRenderer {
  private scene: Phaser.Scene;
  private pool: PoolEntry[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._buildPool();
  }

  private _buildPool(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const text = this.scene.add.text(0, 0, '', {
        fontSize: '16px',
        fontFamily: '"Noto Sans KR", monospace',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setDepth(120).setAlpha(0).setScrollFactor(1);

      this.pool.push({ text, tween: null, inUse: false });
    }
  }

  private _acquire(): PoolEntry | null {
    return this.pool.find(e => !e.inUse) ?? null;
  }

  private _release(entry: PoolEntry): void {
    entry.tween?.stop();
    entry.tween = null;
    entry.text.setAlpha(0).setText('');
    entry.inUse = false;
  }

  /** 데미지/치유 숫자 팝업 */
  show(
    worldX: number,
    worldY: number,
    value: number | string,
    type: DamageType = 'normal',
  ): void {
    const entry = this._acquire();
    if (!entry) return;  // 풀 소진 시 무시

    entry.inUse = true;
    const s = DMG_STYLE[type];
    const label = typeof value === 'string'
      ? value
      : `${s.prefix}${value}`;

    entry.text
      .setText(label)
      .setFontSize(s.size)
      .setColor(s.color)
      .setStroke(s.stroke, 3)
      .setPosition(worldX + Phaser.Math.Between(-10, 10), worldY)
      .setAlpha(1)
      .setScale(type === 'crit' ? 1.3 : 1.0)
      .setDepth(120 + worldY * 0.001);  // 월드 Y 기준 미세 정렬

    // 크리티컬: 먼저 펀치 스케일
    const startScale = type === 'crit' ? 1.6 : 1.0;
    entry.text.setScale(startScale);

    const floatY  = worldY - 40 - (type === 'crit' ? 15 : 0);
    const floatX  = worldX + Phaser.Math.FloatBetween(-14, 14);
    const duration = type === 'crit' ? 900 : 700;

    entry.tween = this.scene.tweens.add({
      targets: entry.text,
      x: floatX,
      y: floatY,
      alpha: { from: 1, to: 0 },
      scaleX: type === 'crit' ? 1.0 : 0.85,
      scaleY: type === 'crit' ? 1.0 : 0.85,
      duration,
      ease: type === 'crit' ? 'Back.easeOut' : 'Sine.easeOut',
      onComplete: () => this._release(entry),
    });
  }

  /** MISS / BLOCK 텍스트 */
  showLabel(
    worldX: number,
    worldY: number,
    label: 'MISS' | 'BLOCK' | 'DODGE' | 'IMMUNE',
  ): void {
    const typeMap: Record<string, DamageType> = {
      MISS: 'miss', BLOCK: 'block', DODGE: 'miss', IMMUNE: 'block',
    };
    this.show(worldX, worldY, label, typeMap[label] ?? 'miss');
  }

  /** 콤보 카운터 강조 팝업 */
  showCombo(worldX: number, worldY: number, combo: number): void {
    if (combo < 2) return;
    const entry = this._acquire();
    if (!entry) return;
    entry.inUse = true;

    const label = `${combo} HIT!`;
    const size  = Math.min(24, 14 + combo * 2);

    entry.text
      .setText(label)
      .setFontSize(size)
      .setColor('#ff8844')
      .setStroke('#441100', 4)
      .setPosition(worldX, worldY - 10)
      .setAlpha(1)
      .setScale(1.4);

    entry.tween = this.scene.tweens.add({
      targets: entry.text,
      y: worldY - 55,
      alpha: 0,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 800,
      ease: 'Sine.easeOut',
      onComplete: () => this._release(entry),
    });
  }

  destroy(): void {
    this.pool.forEach(e => {
      e.tween?.stop();
      e.text.destroy();
    });
    this.pool.length = 0;
  }
}
```

---

## 3. 크리티컬 히트 화면 연출

```typescript
// src/rendering/DamageNumberRenderer.ts (추가)

export function playCriticalHitFX(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
): void {
  // 황금 섬광 원
  const flash = scene.add.graphics()
    .fillStyle(0xffdd22, 0.7)
    .fillCircle(0, 0, 20)
    .setPosition(worldX, worldY)
    .setDepth(119);

  scene.tweens.add({
    targets: flash,
    scaleX: 2.5, scaleY: 2.5, alpha: 0,
    duration: 250,
    ease: 'Expo.easeOut',
    onComplete: () => flash.destroy(),
  });

  // 방사형 선 8개
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const line = scene.add.graphics()
      .lineStyle(2, 0xffdd22, 0.9)
      .strokeLineShape(new Phaser.Geom.Line(
        worldX + Math.cos(angle) * 8,
        worldY + Math.sin(angle) * 8,
        worldX + Math.cos(angle) * 22,
        worldY + Math.sin(angle) * 22,
      ))
      .setDepth(119);

    scene.tweens.add({
      targets: line,
      alpha: 0,
      scaleX: 1.5, scaleY: 1.5,
      duration: 200,
      delay: i * 10,
      onComplete: () => line.destroy(),
    });
  }

  // 카메라 미세 흔들림
  scene.cameras.main.shake(80, 0.003);
}
```

---

## 4. 연속 데미지 스택 (같은 위치 숫자 겹침 방지)

```typescript
export class DamageStacker {
  private pending: Map<string, { total: number; type: DamageType; timer: Phaser.Time.TimerEvent }> = new Map();
  private renderer: DamageNumberRenderer;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, renderer: DamageNumberRenderer) {
    this.scene = scene;
    this.renderer = renderer;
  }

  /** 같은 타겟의 같은 타입 데미지를 120ms 내 합산 후 한 번에 표시 */
  add(targetId: string, x: number, y: number, value: number, type: DamageType): void {
    const key = `${targetId}_${type}`;
    const existing = this.pending.get(key);

    if (existing) {
      existing.total += value;
      existing.timer.reset({
        delay: 120,
        callback: () => {
          this.renderer.show(x, y, existing.total, type);
          this.pending.delete(key);
        },
      });
    } else {
      const timer = this.scene.time.delayedCall(120, () => {
        this.renderer.show(x, y, value, type);
        this.pending.delete(key);
      });
      this.pending.set(key, { total: value, type, timer });
    }
  }

  destroy(): void {
    for (const [, entry] of this.pending) entry.timer.remove();
    this.pending.clear();
  }
}
```

---

## 5. 상태이상 아이콘 팝업

```typescript
// 상태이상 적용 시 아이콘 + 텍스트 팝업
export function showStatusEffect(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  effect: 'poison' | 'burn' | 'freeze' | 'stun' | 'bleed',
): void {
  const icons: Record<typeof effect, { emoji: string; color: number }> = {
    poison: { emoji: '☠',  color: 0x88ff44 },
    burn:   { emoji: '🔥', color: 0xff4400 },
    freeze: { emoji: '❄',  color: 0x88ddff },
    stun:   { emoji: '★',  color: 0xffdd44 },
    bleed:  { emoji: '♥',  color: 0xff2244 },
  };
  const { emoji, color } = icons[effect];

  const txt = scene.add.text(worldX, worldY - 12, emoji, {
    fontSize: '18px',
  }).setDepth(121).setOrigin(0.5);

  scene.tweens.add({
    targets: txt,
    y: worldY - 36,
    alpha: { from: 1, to: 0 },
    duration: 600,
    ease: 'Sine.easeOut',
    onComplete: () => txt.destroy(),
  });

  // 색 링
  const ring = scene.add.graphics()
    .lineStyle(2, color, 0.8)
    .strokeCircle(worldX, worldY, 14)
    .setDepth(120);

  scene.tweens.add({
    targets: ring,
    scaleX: 1.8, scaleY: 1.8, alpha: 0,
    duration: 400,
    ease: 'Expo.easeOut',
    onComplete: () => ring.destroy(),
  });
}
```

---

## 6. 보스 체력바 데미지 텍스트

```typescript
// 보스 데미지는 더 크고 오래 표시
export function showBossDamage(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  value: number,
  isCrit: boolean,
): void {
  const size = isCrit ? 28 : 20;
  const color = isCrit ? '#ff4422' : '#ffaaaa';

  const txt = scene.add.text(worldX, worldY, `${isCrit ? '💥' : ''}${value}`, {
    fontSize: `${size}px`,
    fontFamily: 'monospace',
    fontStyle: 'bold',
    color,
    stroke: '#000000',
    strokeThickness: 4,
  }).setDepth(125).setOrigin(0.5).setScale(isCrit ? 1.5 : 1.0);

  scene.tweens.add({
    targets: txt,
    y: worldY - 60,
    scaleX: isCrit ? 1.0 : 0.9,
    scaleY: isCrit ? 1.0 : 0.9,
    alpha: 0,
    duration: isCrit ? 1100 : 800,
    ease: 'Sine.easeOut',
    onComplete: () => txt.destroy(),
  });

  if (isCrit) playCriticalHitFX(scene, worldX, worldY);
}
```

---

## 7. 깊이(Depth) 테이블

| 레이어              | depth     |
|---------------------|-----------|
| 데미지 숫자         | 120       |
| 크리티컬 이펙트     | 119       |
| 상태이상 아이콘     | 121       |
| 보스 데미지 숫자    | 125       |

---

## 8. 사용 예시

```typescript
// GameScene.ts / CombatSystem.ts 초기화
const dmgRenderer = new DamageNumberRenderer(this);
const dmgStacker  = new DamageStacker(this, dmgRenderer);

// 일반 공격 히트
dmgStacker.add(enemyId, enemy.x, enemy.y, 45, 'normal');

// 크리티컬
dmgRenderer.show(enemy.x, enemy.y, 120, 'crit');
playCriticalHitFX(scene, enemy.x, enemy.y);

// 치유 포션
dmgRenderer.show(player.x, player.y, 30, 'heal');

// 독 틱
dmgRenderer.show(enemy.x, enemy.y, 8, 'poison');

// MISS
dmgRenderer.showLabel(player.x, player.y, 'MISS');

// 콤보
dmgRenderer.showCombo(player.x, player.y, 5);

// 상태이상
showStatusEffect(scene, enemy.x, enemy.y, 'burn');
```
