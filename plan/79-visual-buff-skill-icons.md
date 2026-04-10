# Plan 79 — 버프·스킬·단축바 아이콘 UI 비주얼

## 목표
버프/디버프 아이콘, 스킬 단축바, 쿨다운 오버레이, 버프 파티클 이펙트 등
전투 중 HUD 요소의 시각 퀄리티를 향상시킨다.

## 버전
`v0.79.0`

## 대상 파일
- `src/ui/BuffBar.ts` (신규)
- `src/ui/SkillHotbar.ts` (신규)
- `src/rendering/BuffParticles.ts` (신규)

---

## 1. 버프/디버프 아이콘 바

```typescript
// src/ui/BuffBar.ts

export interface BuffEntry {
  id: string;
  type: 'buff' | 'debuff';
  icon: string;          // 이모지 또는 단일 문자
  color: number;
  duration: number;      // 남은 시간 (초)
  maxDuration: number;
  label: string;
}

const BUFF_ICON_SIZE = 28;
const BUFF_GAP = 4;

export class BuffBar {
  private scene: Phaser.Scene;
  private buffs: Map<string, {
    container: Phaser.GameObjects.Container;
    timerGfx: Phaser.GameObjects.Graphics;
    durationTxt: Phaser.GameObjects.Text;
    data: BuffEntry;
  }> = new Map();
  private anchorX: number;
  private anchorY: number;

  constructor(scene: Phaser.Scene, anchorX: number, anchorY: number) {
    this.scene = scene;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
  }

  addBuff(entry: BuffEntry): void {
    this.removeBuff(entry.id);

    const S = BUFF_ICON_SIZE;
    const isDebuff = entry.type === 'debuff';
    const borderColor = isDebuff ? 0xff4444 : entry.color;

    // 배경
    const bg = this.scene.add.graphics()
      .fillStyle(0x111122, 0.9)
      .fillRoundedRect(0, 0, S, S, 5)
      .lineStyle(1.5, borderColor, 0.9)
      .strokeRoundedRect(0, 0, S, S, 5);

    // 아이콘
    const iconTxt = this.scene.add.text(S / 2, S / 2 - 2, entry.icon, {
      fontSize: '16px', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 남은 시간 텍스트
    const durationTxt = this.scene.add.text(S / 2, S - 6, '', {
      fontSize: '8px', fontFamily: 'monospace',
      color: '#cccccc',
    }).setOrigin(0.5);

    // 쿨다운 원형 오버레이 (시계방향 스윕)
    const timerGfx = this.scene.add.graphics().setDepth(1);

    const container = this.scene.add.container(0, 0, [bg, timerGfx, iconTxt, durationTxt])
      .setDepth(170)
      .setScrollFactor(0)
      .setAlpha(0);

    // 팝인 애니메이션
    container.setScale(0.5);
    this.scene.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // 디버프면 흔들림 1회
    if (isDebuff) {
      this.scene.tweens.add({
        targets: container,
        x: container.x + 3,
        yoyo: true,
        repeat: 3,
        duration: 40,
        ease: 'Linear',
      });
    }

    this.buffs.set(entry.id, { container, timerGfx, durationTxt, data: entry });
    this._layout();
  }

  /** 매 프레임 업데이트: 남은 시간 및 원형 타이머 갱신 */
  update(delta: number): void {
    for (const [id, entry] of this.buffs) {
      entry.data.duration -= delta / 1000;

      if (entry.data.duration <= 0) {
        this._playExpireEffect(entry.container);
        this.removeBuff(id);
        continue;
      }

      const ratio = entry.data.duration / entry.data.maxDuration;
      const S = BUFF_ICON_SIZE;

      // 원형 타이머 오버레이 (파이 슬라이스)
      entry.timerGfx.clear();
      if (ratio < 1) {
        const startAngle = -Math.PI / 2;
        const endAngle   = startAngle + Math.PI * 2 * (1 - ratio);
        entry.timerGfx.fillStyle(0x000000, 0.55);
        // 파이 채우기: 원점 기준 삼각형 부채꼴 근사
        const steps = Math.max(3, Math.floor((endAngle - startAngle) / 0.15));
        const points: { x: number; y: number }[] = [{ x: S / 2, y: S / 2 }];
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + (endAngle - startAngle) * (i / steps);
          points.push({ x: S / 2 + Math.cos(a) * S, y: S / 2 + Math.sin(a) * S });
        }
        entry.timerGfx.fillPoints(points, true);
      }

      // 3초 이하: 숫자 표시 + 빨간 테두리 깜빡임
      if (entry.data.duration <= 3) {
        entry.durationTxt.setText(Math.ceil(entry.data.duration).toString());
        const blinkAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
        entry.container.setAlpha(blinkAlpha);
      } else {
        entry.durationTxt.setText('');
        entry.container.setAlpha(1);
      }
    }
  }

  private _playExpireEffect(container: Phaser.GameObjects.Container): void {
    this.scene.tweens.add({
      targets: container,
      scaleX: 1.3, scaleY: 1.3, alpha: 0,
      duration: 250,
      ease: 'Expo.easeOut',
      onComplete: () => container.destroy(),
    });
  }

  private _layout(): void {
    let i = 0;
    for (const [, entry] of this.buffs) {
      const targetX = this.anchorX + i * (BUFF_ICON_SIZE + BUFF_GAP);
      this.scene.tweens.add({
        targets: entry.container,
        x: targetX, y: this.anchorY,
        duration: 150,
        ease: 'Cubic.easeOut',
      });
      i++;
    }
  }

  removeBuff(id: string): void {
    const entry = this.buffs.get(id);
    if (!entry) return;
    entry.container.destroy();
    this.buffs.delete(id);
    this._layout();
  }

  destroy(): void {
    for (const [id] of this.buffs) this.removeBuff(id);
  }
}
```

---

## 2. 스킬 단축바

```typescript
// src/ui/SkillHotbar.ts

export interface SkillSlotData {
  index: number;         // 0-based
  icon: string;          // 이모지
  label: string;
  cooldown: number;      // 현재 남은 쿨 (초)
  maxCooldown: number;
  mpCost: number;
  active: boolean;
  key: string;           // 단축키 표시 ('1'~'6')
}

const SKILL = {
  SIZE:     48,
  GAP:      6,
  COUNT:    6,
  BG:       0x111122,
  ACTIVE:   0x4488ff,
  INACTIVE: 0x445566,
  FONT:     '"Noto Sans KR", monospace',
} as const;

export class SkillHotbar {
  private scene: Phaser.Scene;
  private slots: Map<number, {
    container: Phaser.GameObjects.Container;
    cooldownGfx: Phaser.GameObjects.Graphics;
    cooldownTxt: Phaser.GameObjects.Text;
    data: SkillSlotData;
  }> = new Map();
  private anchorX: number;
  private anchorY: number;

  constructor(scene: Phaser.Scene, anchorX: number, anchorY: number) {
    this.scene = scene;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
  }

  setSlot(data: SkillSlotData): void {
    this.removeSlot(data.index);
    this._buildSlot(data);
  }

  private _buildSlot(data: SkillSlotData): void {
    const S = SKILL.SIZE;
    const x = this.anchorX + data.index * (S + SKILL.GAP);
    const y = this.anchorY;

    // 배경
    const bg = this.scene.add.graphics()
      .fillStyle(SKILL.BG, 0.9)
      .fillRoundedRect(0, 0, S, S, 6)
      .lineStyle(1.5, data.active ? SKILL.ACTIVE : SKILL.INACTIVE, 1)
      .strokeRoundedRect(0, 0, S, S, 6);

    // 아이콘 텍스트
    const iconTxt = this.scene.add.text(S / 2, S / 2 - 4, data.icon, {
      fontSize: '22px', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 단축키 라벨 (좌상단)
    const keyTxt = this.scene.add.text(4, 3, data.key, {
      fontSize: '9px', fontFamily: 'monospace',
      color: '#888888',
    });

    // MP 비용 (우하단)
    const mpTxt = this.scene.add.text(S - 4, S - 4, `${data.mpCost}`, {
      fontSize: '9px', fontFamily: 'monospace',
      color: '#4488ff',
    }).setOrigin(1, 1);

    // 쿨다운 오버레이
    const cooldownGfx = this.scene.add.graphics().setDepth(1);
    const cooldownTxt = this.scene.add.text(S / 2, S / 2, '', {
      fontSize: '14px', fontFamily: 'monospace',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2);

    const container = this.scene.add.container(x, y, [
      bg, cooldownGfx, iconTxt, keyTxt, mpTxt, cooldownTxt,
    ]).setDepth(165).setScrollFactor(0);

    this.slots.set(data.index, { container, cooldownGfx, cooldownTxt, data });
  }

  update(delta: number): void {
    for (const [, slot] of this.slots) {
      if (slot.data.cooldown <= 0) {
        slot.cooldownGfx.clear();
        slot.cooldownTxt.setText('');
        continue;
      }

      slot.data.cooldown -= delta / 1000;
      slot.data.cooldown = Math.max(0, slot.data.cooldown);

      const ratio = slot.data.cooldown / slot.data.maxCooldown;
      const S = SKILL.SIZE;
      const cx = S / 2, cy = S / 2;

      // 쿨다운 파이 오버레이
      slot.cooldownGfx.clear().fillStyle(0x000000, 0.65);
      const startA = -Math.PI / 2;
      const endA   = startA + Math.PI * 2 * ratio;
      const steps  = Math.max(4, Math.floor((endA - startA) / 0.12));
      const pts: { x: number; y: number }[] = [{ x: cx, y: cy }];
      for (let i = 0; i <= steps; i++) {
        const a = startA + (endA - startA) * (i / steps);
        pts.push({ x: cx + Math.cos(a) * S, y: cy + Math.sin(a) * S });
      }
      slot.cooldownGfx.fillPoints(pts, true);

      // 쿨다운 숫자
      slot.cooldownTxt.setText(slot.data.cooldown >= 1
        ? Math.ceil(slot.data.cooldown).toString()
        : slot.data.cooldown.toFixed(1));

      // 쿨 완료 직전 0.5s 이하: 점멸 + 완료 이펙트 준비
      if (slot.data.cooldown < 0.5 && slot.data.cooldown > 0) {
        const blink = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
        slot.cooldownGfx.setAlpha(blink);
      }
    }
  }

  /** 쿨다운 완료 시 슬롯 강조 이펙트 */
  playCooldownReady(index: number): void {
    const slot = this.slots.get(index);
    if (!slot) return;
    this.scene.tweens.add({
      targets: slot.container,
      scaleX: 1.15, scaleY: 1.15,
      yoyo: true,
      duration: 150,
      ease: 'Back.easeOut',
    });
    // 황금 링 방출
    const x = slot.container.x + SKILL.SIZE / 2;
    const y = slot.container.y + SKILL.SIZE / 2;
    const ring = this.scene.add.graphics()
      .lineStyle(2, 0xffdd44, 1)
      .strokeCircle(x, y, SKILL.SIZE / 2)
      .setDepth(166)
      .setScrollFactor(0);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2, scaleY: 2, alpha: 0,
      duration: 350,
      ease: 'Expo.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** 스킬 사용 시 클릭 이펙트 */
  playActivate(index: number): void {
    const slot = this.slots.get(index);
    if (!slot) return;
    this.scene.tweens.add({
      targets: slot.container,
      scaleX: 0.88, scaleY: 0.88,
      yoyo: true,
      duration: 80,
      ease: 'Sine.easeOut',
    });
  }

  removeSlot(index: number): void {
    this.slots.get(index)?.container.destroy();
    this.slots.delete(index);
  }

  destroy(): void {
    for (const [i] of this.slots) this.removeSlot(i);
  }
}
```

---

## 3. 버프 적용 파티클

```typescript
// src/rendering/BuffParticles.ts

export function playBuffApplyEffect(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  type: 'heal' | 'strength' | 'speed' | 'shield' | 'poison',
): void {
  const colorMap: Record<typeof type, number> = {
    heal:     0x44ff88,
    strength: 0xff4444,
    speed:    0x44ffff,
    shield:   0x8888ff,
    poison:   0x88ff44,
  };
  const color = colorMap[type];

  // 아래에서 위로 올라오는 파티클 6개
  for (let i = 0; i < 6; i++) {
    const px = worldX + Phaser.Math.Between(-12, 12);
    const dot = scene.add.graphics()
      .fillStyle(color, 0.9)
      .fillCircle(0, 0, Phaser.Math.Between(2, 4))
      .setPosition(px, worldY + 8)
      .setDepth(65);

    scene.tweens.add({
      targets: dot,
      y: worldY - 24 - Phaser.Math.Between(0, 12),
      alpha: 0,
      duration: 500 + i * 60,
      delay: i * 50,
      ease: 'Sine.easeOut',
      onComplete: () => dot.destroy(),
    });
  }

  // 중앙 원 확산
  const ring = scene.add.graphics()
    .lineStyle(2, color, 0.8)
    .strokeCircle(0, 0, 10)
    .setPosition(worldX, worldY)
    .setDepth(64);

  scene.tweens.add({
    targets: ring,
    scaleX: 2.2, scaleY: 2.2, alpha: 0,
    duration: 350,
    ease: 'Expo.easeOut',
    onComplete: () => ring.destroy(),
  });
}

export function playDebuffApplyEffect(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  type: 'poison' | 'slow' | 'stun' | 'burn',
): void {
  const colorMap: Record<typeof type, number> = {
    poison: 0x88ff44,
    slow:   0x4488ff,
    stun:   0xffdd44,
    burn:   0xff4422,
  };
  const color = colorMap[type];

  // 위에서 아래로 떨어지는 X 마크
  const xMark = scene.add.text(worldX, worldY - 20, '✕', {
    fontSize: '18px', fontFamily: 'monospace',
    color: Phaser.Display.Color.IntegerToColor(color).rgba,
    stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(65);

  scene.tweens.add({
    targets: xMark,
    y: worldY + 4,
    alpha: 0,
    duration: 450,
    ease: 'Sine.easeIn',
    onComplete: () => xMark.destroy(),
  });

  // 진동 링 3개
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics()
      .lineStyle(1.5, color, 0.7)
      .strokeCircle(0, 0, 12 + i * 4)
      .setPosition(worldX, worldY)
      .setDepth(64);

    scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 0.5, scaleY: 0.5,
      duration: 300,
      delay: i * 60,
      ease: 'Expo.easeIn',
      onComplete: () => ring.destroy(),
    });
  }
}
```

---

## 4. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 버프 파티클          | 64–65 |
| 스킬 단축바          | 165   |
| 버프 바             | 170   |
