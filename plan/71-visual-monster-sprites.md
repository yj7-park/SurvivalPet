# Plan 71 — 몬스터·동물 스프라이트 & 애니메이션

## 개요

plan 40(캐릭터 스프라이트)·plan 46(전투 이펙트)을 기반으로  
게임에 등장하는 **동물 및 몬스터**의 스프라이트 생성 함수와  
idle·walk·attack·hurt·death 5종 애니메이션을 설계한다.  
모두 Canvas 2D API로 절차적으로 생성하며 스프라이트시트 레이아웃을 정의한다.

---

## 1. 스프라이트시트 규격

```typescript
// 몬스터 공통 스프라이트시트 레이아웃
// frameWidth=32, frameHeight=32 (작은 몬스터)
// frameWidth=48, frameHeight=48 (중간)
// frameWidth=64, frameHeight=64 (보스)

const MONSTER_ANIM_LAYOUT = {
  idle:   { row: 0, frames: 4 },  // 0-3
  walk:   { row: 1, frames: 6 },  // 4-9
  attack: { row: 2, frames: 5 },  // 10-14
  hurt:   { row: 3, frames: 2 },  // 15-16
  death:  { row: 4, frames: 6 },  // 17-22
} as const;

function getFrameIndex(anim: keyof typeof MONSTER_ANIM_LAYOUT, frame: number): number {
  return MONSTER_ANIM_LAYOUT[anim].row * 6 + frame;  // 6열 기준
}
```

---

## 2. 몬스터별 스프라이트 생성

### 2-1. 슬라임 (Slime) — 32×32

```typescript
function drawSlimeFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: 'idle' | 'walk' | 'attack' | 'hurt' | 'death',
  frame: number,
  color: number = 0x44cc66
): void {
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  const cx = x + 16, cy = y + 20;

  ctx.clearRect(x, y, 32, 32);

  if (anim === 'death') {
    // 점점 납작해져 사라짐
    const flatness = frame / 5;
    ctx.fillStyle = hex;
    ctx.globalAlpha = 1 - flatness * 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, y + 28, 12 + flatness * 4, 6 - flatness * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // 몸통 — idle/walk: 위아래 squash & stretch
  const bounce = anim === 'idle'
    ? Math.sin(frame * Math.PI / 2) * 2
    : Math.sin(frame * Math.PI / 3) * 3;

  const bodyH = 14 - bounce;
  const bodyW = 12 + bounce * 0.5;

  // 몸통
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.ellipse(cx, cy - bodyH / 2, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // 하이라이트
  ctx.fillStyle = '#ffffff44';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - bodyH / 2 - 3, bodyW * 0.4, bodyH * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (attack 시 붉게)
  const eyeColor = anim === 'attack' ? '#ff2020' : '#ffffff';
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - bodyH / 2, 2, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 3, cy - bodyH / 2, 2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 동공
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - bodyH / 2 + 0.5, 1, 1.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 3, cy - bodyH / 2 + 0.5, 1, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // hurt: 빨간 틴트
  if (anim === 'hurt') {
    ctx.fillStyle = '#ff000033';
    ctx.beginPath();
    ctx.ellipse(cx, cy - bodyH / 2, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // attack 프레임 3: 점프 올라감
  if (anim === 'attack' && frame === 2) {
    ctx.translate(0, -6);
  }
}
```

### 2-2. 고블린 (Goblin) — 32×32

```typescript
function drawGoblinFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: keyof typeof MONSTER_ANIM_LAYOUT,
  frame: number
): void {
  ctx.clearRect(x, y, 32, 32);
  const flip = false;  // 방향에 따라 setFlipX

  // 다리 (walk: 교차 움직임)
  const legSwing = anim === 'walk' ? Math.sin(frame * Math.PI / 3) * 4 : 0;
  ctx.fillStyle = '#3a6e3a';
  ctx.fillRect(x + 11, y + 22, 4, 8 + legSwing);
  ctx.fillRect(x + 17, y + 22, 4, 8 - legSwing);

  // 몸통
  ctx.fillStyle = '#4a8a4a';
  ctx.fillRect(x + 10, y + 14, 12, 10);

  // 머리
  ctx.fillStyle = '#5aa05a';
  ctx.fillRect(x + 11, y + 6, 10, 9);

  // 귀 (뾰족)
  ctx.fillStyle = '#5aa05a';
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 8);
  ctx.lineTo(x + 8,  y + 4);
  ctx.lineTo(x + 12, y + 9);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 21, y + 8);
  ctx.lineTo(x + 24, y + 4);
  ctx.lineTo(x + 20, y + 9);
  ctx.fill();

  // 눈
  ctx.fillStyle = anim === 'attack' ? '#ff4400' : '#ffee00';
  ctx.fillRect(x + 13, y + 8, 3, 3);
  ctx.fillRect(x + 18, y + 8, 3, 3);

  // 무기 (곤봉) — attack 프레임에 따라 각도 변경
  if (anim === 'attack') {
    const swingAngle = frame < 2 ? -Math.PI / 4 : Math.PI / 3;
    ctx.save();
    ctx.translate(x + 22, y + 16);
    ctx.rotate(swingAngle);
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(-2, -10, 3, 12);
    ctx.fillStyle = '#a07820';
    ctx.fillRect(-3, -12, 5, 5);
    ctx.restore();
  }

  // death: 쓰러짐 (90도 회전)
  if (anim === 'death') {
    ctx.globalAlpha = Math.max(0, 1 - frame * 0.18);
  }
}
```

### 2-3. 늑대 (Wolf) — 48×32

```typescript
function drawWolfFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: keyof typeof MONSTER_ANIM_LAYOUT,
  frame: number
): void {
  ctx.clearRect(x, y, 48, 32);

  const walkCycle = anim === 'walk' ? frame / 6 : 0;
  const bodyBob = Math.sin(walkCycle * Math.PI * 2) * 1.5;

  // 몸통 (타원형)
  ctx.fillStyle = '#778899';
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 20 + bodyBob, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 다리 4개
  const legAngles = [
    Math.sin(walkCycle * Math.PI * 2) * 0.4,
    Math.sin(walkCycle * Math.PI * 2 + Math.PI) * 0.4,
    Math.sin(walkCycle * Math.PI * 2 + Math.PI * 0.5) * 0.4,
    Math.sin(walkCycle * Math.PI * 2 + Math.PI * 1.5) * 0.4,
  ];

  ctx.fillStyle = '#667788';
  const legPositions = [x + 14, x + 18, x + 28, x + 32];
  legPositions.forEach((lx, i) => {
    ctx.fillRect(lx, y + 24 + bodyBob, 3, 7 + Math.sin(legAngles[i]) * 3);
  });

  // 머리
  ctx.fillStyle = '#889aaa';
  ctx.beginPath();
  ctx.ellipse(x + 38, y + 17 + bodyBob, 8, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 주둥이
  ctx.fillStyle = '#99abb8';
  ctx.beginPath();
  ctx.ellipse(x + 44, y + 19 + bodyBob, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  ctx.fillStyle = anim === 'attack' ? '#ff2200' : '#ffdd00';
  ctx.fillRect(x + 38, y + 15 + bodyBob, 3, 2);

  // 꼬리
  const tailAngle = Math.sin(walkCycle * Math.PI * 2 + Math.PI) * 0.5;
  ctx.strokeStyle = '#778899';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 18 + bodyBob);
  ctx.quadraticCurveTo(
    x + 2, y + 10 + bodyBob + tailAngle * 8,
    x + 5, y + 8 + bodyBob + tailAngle * 12
  );
  ctx.stroke();

  // attack: 점프 앞으로
  if (anim === 'attack' && frame >= 2 && frame <= 3) {
    // 이전 프레임 대비 x 오프셋은 씬에서 tween으로 처리
  }
}
```

### 2-4. 보스 — 골렘 (Golem) — 64×64

```typescript
function drawGolemFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: keyof typeof MONSTER_ANIM_LAYOUT,
  frame: number
): void {
  ctx.clearRect(x, y, 64, 64);

  const shake = anim === 'attack' && frame >= 2
    ? Math.sin(frame * Math.PI) * 3
    : 0;

  // 다리 (큰 블록)
  ctx.fillStyle = '#666677';
  ctx.fillRect(x + 12 + shake, y + 46, 14, 16);
  ctx.fillRect(x + 38 - shake, y + 46, 14, 16);

  // 몸통
  ctx.fillStyle = '#7a7a8e';
  ctx.fillRect(x + 8, y + 22, 48, 26);

  // 바위 텍스처 (균열 선)
  ctx.strokeStyle = '#55555f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 22); ctx.lineTo(x + 25, y + 35); ctx.lineTo(x + 18, y + 48);
  ctx.moveTo(x + 38, y + 25); ctx.lineTo(x + 44, y + 40); ctx.lineTo(x + 36, y + 48);
  ctx.stroke();

  // 팔 (attack 시 올라감)
  const armRaise = anim === 'attack' ? -frame * 5 : 0;
  ctx.fillStyle = '#7a7a8e';
  ctx.fillRect(x + 0, y + 24 + armRaise, 10, 20);  // 왼쪽
  ctx.fillRect(x + 54, y + 24 + armRaise, 10, 20); // 오른쪽

  // 머리
  ctx.fillStyle = '#8a8a9e';
  ctx.fillRect(x + 16, y + 4, 32, 20);

  // 눈 (glowing)
  const eyeColor = anim === 'attack' ? '#ff4400' : '#cc4400';
  ctx.fillStyle = eyeColor;
  ctx.fillRect(x + 21, y + 10, 8, 6);
  ctx.fillRect(x + 35, y + 10, 8, 6);
  // 빛 효과
  ctx.fillStyle = eyeColor + '44';
  ctx.fillRect(x + 19, y + 8, 12, 10);
  ctx.fillRect(x + 33, y + 8, 12, 10);

  // death: 분해되는 느낌 (조각 분리)
  if (anim === 'death') {
    ctx.globalAlpha = Math.max(0, 1 - frame * 0.18);
    ctx.translate(0, frame * 2);
  }
}
```

---

## 3. 스프라이트시트 생성 함수

```typescript
function generateMonsterSpritesheet(
  type: 'slime' | 'goblin' | 'wolf' | 'golem',
  variant = 0
): HTMLCanvasElement {
  const FW = type === 'golem' ? 64 : type === 'wolf' ? 48 : 32;
  const FH = type === 'golem' ? 64 : 32;
  const COLS = 6;
  const ROWS = 5;

  const canvas = document.createElement('canvas');
  canvas.width  = FW * COLS;
  canvas.height = FH * ROWS;
  const ctx = canvas.getContext('2d')!;

  const ANIMS: Array<keyof typeof MONSTER_ANIM_LAYOUT> = ['idle', 'walk', 'attack', 'hurt', 'death'];
  const DRAW_FN = {
    slime:  drawSlimeFrame,
    goblin: drawGoblinFrame,
    wolf:   drawWolfFrame,
    golem:  drawGolemFrame,
  };

  ANIMS.forEach((anim, row) => {
    const frameCount = MONSTER_ANIM_LAYOUT[anim].frames;
    for (let f = 0; f < frameCount; f++) {
      DRAW_FN[type](ctx, f * FW, row * FH, anim, f);
    }
  });

  return canvas;
}
```

---

## 4. Phaser 애니메이션 등록

```typescript
function registerMonsterAnims(scene: Phaser.Scene, type: string): void {
  const FW = type === 'golem' ? 64 : type === 'wolf' ? 48 : 32;
  const FH = type === 'golem' ? 64 : 32;
  const key = `monster_${type}`;

  // 스프라이트시트 등록
  const canvas = generateMonsterSpritesheet(type as any);
  scene.textures.addCanvas(key, canvas);

  // 애니메이션 정의
  const anims: Array<{ name: string; start: number; end: number; fps: number; repeat: number }> = [
    { name: `${key}_idle`,   start: 0,  end: 3,  fps: 4,  repeat: -1 },
    { name: `${key}_walk`,   start: 4,  end: 9,  fps: 8,  repeat: -1 },
    { name: `${key}_attack`, start: 10, end: 14, fps: 10, repeat: 0  },
    { name: `${key}_hurt`,   start: 15, end: 16, fps: 8,  repeat: 0  },
    { name: `${key}_death`,  start: 17, end: 22, fps: 6,  repeat: 0  },
  ];

  anims.forEach(({ name, start, end, fps, repeat }) => {
    if (!scene.anims.exists(name)) {
      scene.anims.create({
        key: name,
        frames: scene.anims.generateFrameNumbers(key, { start, end }),
        frameRate: fps,
        repeat,
      });
    }
  });
}
```

---

## 5. 몬스터 사망 이펙트

```typescript
function playMonsterDeathEffect(
  scene: Phaser.Scene,
  monster: MonsterEntity
): void {
  // 1. death 애니메이션 재생
  monster.sprite.play(`monster_${monster.type}_death`);

  // 2. 파티클 버스트 (몬스터 색상)
  const tint = MONSTER_TINTS[monster.type] ?? 0x888888;
  const emitter = scene.add.particles(monster.worldX, monster.worldY, '__DEFAULT', {
    speed: { min: 50, max: 120 },
    scale: { start: 0.7, end: 0 },
    lifespan: 500,
    quantity: 12,
    tint,
    blendMode: Phaser.BlendModes.NORMAL,
  });
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());

  // 3. 쓰러짐 카메라 진동 (보스만)
  if (monster.type === 'golem') {
    scene.cameras.main.shake(400, 0.012);
    // 화면 빨간 플래시
    const flash = scene.add.rectangle(
      scene.cameras.main.scrollX + scene.cameras.main.width / 2,
      scene.cameras.main.scrollY + scene.cameras.main.height / 2,
      scene.cameras.main.width, scene.cameras.main.height,
      0xff2200, 0.18
    ).setScrollFactor(0).setDepth(80);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  }

  // 4. 사망 후 스프라이트 페이드아웃
  monster.sprite.once('animationcomplete', () => {
    scene.tweens.add({
      targets: monster.sprite,
      alpha: 0,
      y: monster.sprite.y + 8,
      duration: 600,
      onComplete: () => monster.destroy(),
    });
  });
}
```

---

## 6. 몬스터 피격 이펙트

```typescript
function playMonsterHurtEffect(
  scene: Phaser.Scene,
  monster: MonsterEntity
): void {
  monster.sprite.play(`monster_${monster.type}_hurt`);

  // 흰색 플래시 (plan 46 방식)
  monster.sprite.setTint(0xffffff);
  scene.time.delayedCall(80, () => monster.sprite.clearTint());

  // 피 파티클 (빨간)
  const emitter = scene.add.particles(monster.worldX, monster.worldY, '__DEFAULT', {
    speed: { min: 20, max: 60 },
    angle: { min: -150, max: -30 },
    scale: { start: 0.3, end: 0 },
    lifespan: 300,
    quantity: 5,
    tint: 0xdd2222,
  }).setDepth(monster.sprite.depth + 1);
  emitter.explode(5);
  scene.time.delayedCall(400, () => emitter.destroy());
}
```

---

## 7. 동물 스프라이트 (토끼·사슴·닭)

```typescript
// 토끼 — 가장 단순, 32×24
function drawRabbitFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  anim: 'idle' | 'walk' | 'flee',
  frame: number
): void {
  ctx.clearRect(x, y, 32, 24);
  const hop = (anim === 'walk' || anim === 'flee')
    ? Math.abs(Math.sin(frame * Math.PI / 3)) * (anim === 'flee' ? 8 : 4)
    : 0;

  // 몸통
  ctx.fillStyle = '#e8ddd0';
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 18 - hop, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 머리
  ctx.fillStyle = '#ede3d8';
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 13 - hop, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 귀
  ctx.fillStyle = '#ede3d8';
  ctx.fillRect(x + 20, y + 3 - hop, 3, 10);
  ctx.fillRect(x + 24, y + 3 - hop, 3, 10);
  // 귀 안쪽
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(x + 21, y + 4 - hop, 1, 8);
  ctx.fillRect(x + 25, y + 4 - hop, 1, 8);

  // 눈
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 23, y + 12 - hop, 2, 2);

  // 꼬리
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + 9, y + 17 - hop, 3, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 8. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 동물 스프라이트 | 30 | 지면 오브젝트 위, 캐릭터 아래 |
| 몬스터 스프라이트 | 35 | 캐릭터와 동일 레이어 |
| 몬스터 피격 파티클 | 40 | |
| 몬스터 사망 파티클 | 55 | |
| 보스 사망 플래시 | 80 | HUD 뒤 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/sprites/MonsterSprites.ts` | 몬스터 스프라이트 생성 함수 |
| `src/sprites/AnimalSprites.ts` | 동물 스프라이트 생성 함수 |
| `src/systems/MonsterAnimManager.ts` | Phaser 애니메이션 등록 |
| `src/fx/MonsterEffects.ts` | 피격·사망 이펙트 |

---

## 10. 버전

`v0.71.0`
