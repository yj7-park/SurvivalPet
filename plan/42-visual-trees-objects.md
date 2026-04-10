# 설계 42 — 나무·오브젝트 비주얼 고도화

> **전제 조건**: 01~41 단계 완료 상태.
> plan 03(기본 나무 스프라이트), plan 09(바람 흔들림·벌목 파티클),
> plan 41(계절 팔레트)을 기반으로 나무·오브젝트의 비주얼을 확장한다.

---

## 1. 이번 단계 목표

1. **계절별 나무 스프라이트** — 봄 연두 / 여름 진녹 / 가을 단풍 / 겨울 설목
2. **나무 쓰러짐 애니메이션** — 벌목 완료 시 방향별 쓰러짐 + 파편
3. **나무 재생 애니메이션** — 새싹 → 어린 나무 → 완전 성장
4. **암반·바위 비주얼** — 채굴 균열 단계, 파편 방향 이펙트
5. **설치 오브젝트 비주얼** — 작업대·조리대·침대 등 건설물 스프라이트 고도화
6. **낚시 찌 & 물고기 점프** — 낚시 인터랙션 시각 연출

---

## 2. 나무 스프라이트 — 계절 4종

### 2-1. 스프라이트시트 구조

기본 크기 32×48px, 4계절 × 1프레임 = 단일 시트 128×48px:

```
[봄: col0] [여름: col1] [가을: col2] [겨울: col3]
```

키: `obj_tree_seasons` (128×48px 스프라이트시트)

```typescript
// 계절 인덱스로 프레임 선택
const TREE_SEASON_FRAME: Record<Season, number> = {
  spring: 0, summer: 1, autumn: 2, winter: 3,
};
treeSprite.setFrame(TREE_SEASON_FRAME[currentSeason]);
```

### 2-2. 계절별 드로잉 가이드

```typescript
function drawTree(ctx: CanvasRenderingContext2D, season: Season): void {
  const pal = TREE_PALETTES[season];

  // 그림자 (타원, 바닥)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.ellipse(16, 46, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 줄기 (갈색, 하단 중앙)
  ctx.fillStyle = pal.trunk;
  ctx.fillRect(13, 28, 6, 20);
  // 줄기 질감 (어두운 세로줄)
  ctx.fillStyle = pal.trunkDark;
  ctx.fillRect(14, 30, 1, 16);
  ctx.fillRect(17, 32, 1, 14);

  // 잎 (3레이어: 외곽 → 중간 → 하이라이트)
  if (season === 'winter') {
    drawWinterTree(ctx, pal);
  } else {
    drawLeafTree(ctx, pal);
  }
}

const TREE_PALETTES: Record<Season, TreePalette> = {
  spring: {
    trunk:     '#8b5e2a',
    trunkDark: '#6a4420',
    leafOuter: '#5aaa30',   // 연두
    leafMid:   '#48921e',
    leafLight: '#7acc48',   // 하이라이트
  },
  summer: {
    trunk:     '#7a5020',
    trunkDark: '#5a3810',
    leafOuter: '#2a7a18',   // 진녹
    leafMid:   '#1e6010',
    leafLight: '#48a030',
  },
  autumn: {
    trunk:     '#8b5e2a',
    trunkDark: '#6a4420',
    leafOuter: '#c86010',   // 주황/단풍
    leafMid:   '#a04808',
    leafLight: '#e88030',
  },
  winter: {
    trunk:     '#6a5040',
    trunkDark: '#4a3428',
    snow:      '#e8f0f8',   // 흰 눈
    snowShade: '#c0ccd8',
    branch:    '#4a3428',
  },
};
```

### 2-3. 겨울 나무 드로잉

```typescript
function drawWinterTree(ctx: CanvasRenderingContext2D, pal: TreePalette): void {
  // 앙상한 가지만 그리기
  ctx.strokeStyle = pal.branch;
  ctx.lineWidth = 2;
  // 중앙 줄기 연장
  ctx.beginPath(); ctx.moveTo(16, 28); ctx.lineTo(16, 8); ctx.stroke();
  // 좌우 가지 3쌍
  [[16,22, 6,14], [16,18, 8,10], [16,14, 22,8],
   [16,22,26,14], [16,18,24,10], [16,14,10,8]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  // 가지 끝 눈 뭉치
  ctx.fillStyle = pal.snow;
  [[6,13],[8,9],[22,7],[26,13],[24,9],[10,7],[16,7]].forEach(([x,y]) => {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
  });
}
```

---

## 3. 나무 쓰러짐 애니메이션

### 3-1. 쓰러짐 방향 결정

```typescript
// 벌목 완료 시 플레이어 기준 반대 방향으로 쓰러짐
function getFallDirection(playerPos: Vec2, treePos: Vec2): 'left' | 'right' {
  return playerPos.x < treePos.x ? 'right' : 'left';
}
```

### 3-2. 쓰러짐 트윈

```typescript
// Phaser Tween: 0.6초 동안 90° 회전 + 이동
scene.tweens.add({
  targets: treeSprite,
  angle:   fallDir === 'right' ? 90 : -90,
  x:       treeSprite.x + (fallDir === 'right' ? 20 : -20),
  y:       treeSprite.y + 14,
  scaleY:  0.7,          // 원근감 (쓰러지면 납작해 보임)
  duration: 600,
  ease: 'Cubic.easeIn',  // 처음 느리게, 끝에 빠르게
  onComplete: () => {
    treeSprite.destroy();
    spawnFallParticles(treeSprite.x, treeSprite.y, fallDir);
  },
});
```

### 3-3. 낙엽 파티클 (쓰러짐 시)

```typescript
// 쓰러지는 방향으로 잎 파티클 20~30개 방출
function spawnFallParticles(x: number, y: number, dir: 'left' | 'right', season: Season): void {
  const colors = LEAF_FALL_COLORS[season];
  const dirMult = dir === 'right' ? 1 : -1;

  for (let i = 0; i < 25; i++) {
    const angle = Phaser.Math.Between(0, 60) * dirMult;   // 쓰러지는 쪽 부채꼴
    const speed = Phaser.Math.Between(40, 120);
    const leaf  = scene.add.rectangle(x, y, 4, 3,
      Phaser.Utils.Array.GetRandom(colors));

    scene.tweens.add({
      targets: leaf,
      x: leaf.x + Math.cos(Phaser.Math.DegToRad(angle)) * speed,
      y: leaf.y + Math.sin(Phaser.Math.DegToRad(angle)) * speed + 30,
      angle: Phaser.Math.Between(-360, 360),
      alpha: 0,
      duration: Phaser.Math.Between(500, 900),
      ease: 'Quad.easeOut',
      onComplete: () => leaf.destroy(),
    });
  }
}

const LEAF_FALL_COLORS: Record<Season, number[]> = {
  spring: [0x5aaa30, 0x7acc48, 0x48921e],
  summer: [0x2a7a18, 0x48a030, 0x1e6010],
  autumn: [0xc86010, 0xe88030, 0xa04808, 0xdd6020, 0xf0a030],
  winter: [0xe8f0f8, 0xc0ccd8],   // 눈 조각
};
```

---

## 4. 나무 재생 애니메이션

plan 28에서 10분 후 재생성 확정. 3단계 성장 연출:

```typescript
// 재생 시작 시 씨앗 → 새싹 → 어린나무 → 완전한 나무
const REGROW_STAGES = [
  { scale: 0.1, alpha: 0.4, duration: 2000 },   // 씨앗 (2초)
  { scale: 0.4, alpha: 0.7, duration: 3000 },   // 새싹 (3초)
  { scale: 0.8, alpha: 0.9, duration: 3000 },   // 어린나무 (3초)
  { scale: 1.0, alpha: 1.0, duration: 2000 },   // 완전 성장 (2초)
];

function startRegrowAnimation(treeSprite: Phaser.GameObjects.Sprite): void {
  treeSprite.setScale(0.1).setAlpha(0.4).setVisible(true);
  let delay = 0;
  REGROW_STAGES.forEach(stage => {
    scene.tweens.add({
      targets: treeSprite,
      scale: stage.scale, alpha: stage.alpha,
      duration: stage.duration, delay,
      ease: 'Quad.easeOut',
    });
    delay += stage.duration;
  });
}
```

---

## 5. 암반 채굴 비주얼

### 5-1. 균열 오버레이 (채굴 진행도 기반)

plan 22(내구도)의 균열 레벨을 채굴 프로그레스에도 적용:

| 채굴 진행 | 오버레이 스프라이트 |
|---------|----------------|
| 0~33% | `overlay_crack_1` — 가는 균열 1~2개 |
| 33~66% | `overlay_crack_2` — 균열 3~4개, 약간 넓어짐 |
| 66~99% | `overlay_crack_3` — 사방으로 균열, 조각이 들뜸 |

```typescript
// 오버레이 스프라이트 (32×32, 투명 배경 + 검정/회색 균열선)
// overlay_crack_1: 2개의 가는 선 (alpha 0.5)
// overlay_crack_2: 4개 선 (alpha 0.6) + 작은 삼각 조각 들뜸
// overlay_crack_3: 방사형 6개 선 (alpha 0.7) + 중앙 어두워짐
```

### 5-2. 채굴 타격 이펙트

```typescript
// 타격 시마다: 돌 파편 3~5개 + 카메라 흔들림
function onMineHit(x: number, y: number): void {
  scene.cameras.main.shake(60, 0.003);

  for (let i = 0; i < Phaser.Math.Between(3, 5); i++) {
    const chip = scene.add.rectangle(x, y,
      Phaser.Math.Between(2, 5), Phaser.Math.Between(2, 4),
      Phaser.Utils.Array.GetRandom([0x888888, 0xa0a0a0, 0x606060]));
    const angle = Phaser.Math.Between(200, 340);  // 위쪽 부채꼴
    const speed = Phaser.Math.Between(50, 130);
    scene.tweens.add({
      targets: chip,
      x: chip.x + Math.cos(Phaser.Math.DegToRad(angle)) * speed,
      y: chip.y + Math.sin(Phaser.Math.DegToRad(angle)) * speed,
      angle: Phaser.Math.Between(-180, 180),
      alpha: 0,
      duration: Phaser.Math.Between(350, 600),
      ease: 'Quad.easeOut',
      onComplete: () => chip.destroy(),
    });
  }
}
```

---

## 6. 건설물 스프라이트 고도화

### 6-1. 현재 문제

plan 03에서 `struct_wall_wood` 등 기본 사각형 수준으로만 정의됨.
이번 단계에서 **디테일 드로잉 가이드** 확정:

| 건설물 | 드로잉 포인트 |
|--------|------------|
| 목재 벽 | 수평 판자 결, 못 표시, 양 끝 기둥 |
| 석재 벽 | 벽돌 패턴 (4×2 격자), 줄눈 표시 |
| 문 (목재) | 판자 + 경첩 2개 + 손잡이 원 |
| 지붕 | 삼각 지붕 라인 + 기와 줄 |
| 침대 | 프레임 + 매트리스 + 베개 |
| 작업대 | 상판 + 다리 4개 + 공구(망치 실루엣) |
| 조리대 | 상판 + 냄비 실루엣 + 화구 |
| 의자 | 등받이 + 좌판 + 다리 4개 |

```typescript
function drawWoodWall(ctx: CanvasRenderingContext2D): void {
  // 배경 (중간 갈색)
  ctx.fillStyle = '#c8884a'; ctx.fillRect(0, 0, 32, 32);
  // 수평 판자 결 (5줄)
  ctx.fillStyle = '#a06030';
  [5, 11, 17, 23, 29].forEach(y => ctx.fillRect(0, y, 32, 1));
  // 양 끝 기둥 (진한 갈색)
  ctx.fillStyle = '#8b5020';
  ctx.fillRect(0, 0, 3, 32); ctx.fillRect(29, 0, 3, 32);
  // 못 (작은 점)
  ctx.fillStyle = '#4a3010';
  [[4,8],[4,20],[28,8],[28,20]].forEach(([x,y]) => {
    ctx.fillRect(x, y, 2, 2);
  });
  // 외곽선
  ctx.strokeStyle = '#6a3a10'; ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 31, 31);
}
```

### 6-2. 건설 미리보기 (배치 중 투명 표시)

plan 02에서 배치 시 투명 미리보기만 언급. 색상 확정:

```typescript
// 배치 가능: 초록빛 반투명
previewSprite.setTint(0x88ff88).setAlpha(0.6);

// 배치 불가: 빨간빛 반투명
previewSprite.setTint(0xff8888).setAlpha(0.6);

// 깜빡임 (배치 불가 강조)
scene.tweens.add({
  targets: previewSprite,
  alpha: { from: 0.3, to: 0.7 },
  duration: 400, yoyo: true, repeat: -1,
});
```

---

## 7. 낚시 연출 비주얼

### 7-1. 찌 던지기 포물선

```typescript
// 찌가 물 위로 날아가는 포물선 트윈
const targetX = waterTileX * 32 + 16;
const targetY = waterTileY * 32 + 16;

scene.tweens.add({
  targets: bobberSprite,
  x: targetX, y: targetY,
  duration: 400,
  ease: 'Quad.easeOut',
  // 포물선을 위해 중간에 y 보정
  onUpdate: (tween) => {
    const arc = Math.sin(tween.progress * Math.PI) * -30;  // 최대 30px 위
    bobberSprite.y = Phaser.Math.Linear(startY, targetY, tween.progress) + arc;
  },
});
// 착수 시 물 파문 파티클 (plan 09 입수 파문 재사용)
```

### 7-2. 낚시 대기 애니메이션

```typescript
// 찌가 물에서 서서히 흔들리며 대기
scene.tweens.add({
  targets: bobberSprite,
  y: bobberSprite.y + 3,
  duration: 800,
  yoyo: true, repeat: -1,
  ease: 'Sine.easeInOut',
});
```

### 7-3. 물고기 히트 연출

```typescript
// 낚시 성공 직전: 찌가 물속으로 빠르게 당겨짐
scene.tweens.add({
  targets: bobberSprite,
  y: bobberSprite.y + 8, alpha: 0,
  duration: 150, ease: 'Cubic.easeIn',
});
// 물 파문 크게 + 물방울 파티클
// 성공 시: 물고기 점프 (arc 형태로 위로 튀어오름)
spawnFishJump(targetX, targetY);

function spawnFishJump(x: number, y: number): void {
  const fish = scene.add.ellipse(x, y, 10, 5, 0x88ccff);
  scene.tweens.add({
    targets: fish,
    x: x + Phaser.Math.Between(-20, 20),
    y: y - 30,
    angle: -45,
    duration: 200,
    ease: 'Quad.easeOut',
    yoyo: true,
    onComplete: () => fish.destroy(),
  });
}
```

---

## 8. 스프라이트 추가 목록

| 키 | 크기 | 설명 |
|----|------|------|
| `obj_tree_seasons` | 128×48 | 나무 4계절 시트 |
| `overlay_crack_1~3` | 32×32 | 채굴 균열 단계 3종 |
| `struct_wall_wood` | 32×32 | 판자 결 목재 벽 (재드로잉) |
| `struct_wall_stone` | 32×32 | 벽돌 패턴 석재 벽 (재드로잉) |
| `struct_door_wood` | 32×32 | 경첩+손잡이 목재 문 (재드로잉) |
| `struct_bed_wood` | 32×48 | 침대 (32×48, 프레임+매트리스) |
| `struct_workbench_wood` | 32×32 | 공구 실루엣 있는 작업대 |
| `struct_kitchen_wood` | 32×32 | 냄비 실루엣 있는 조리대 |
| `fx_bobber` | 8×8 | 낚시 찌 (빨강/흰 원형) |

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/world/SpriteGenerator.ts` | 나무 4계절 시트, 균열 오버레이, 건설물 재드로잉, 낚시 찌 |
| `src/rendering/TreeRenderer.ts` | 신규: 계절 프레임 전환, 쓰러짐·재생 애니메이션 |
| `src/rendering/ObjectRenderer.ts` | 신규: 암반 균열 오버레이, 건설물 미리보기 색상 |
| `src/systems/FishingSystem.ts` | 낚시 포물선·찌 흔들림·물고기 점프 연출 통합 |
| `src/scenes/GameScene.ts` | TreeRenderer·ObjectRenderer 교체 |

---

## 10. 확정 규칙

- 나무 계절 프레임: 계절 전환 즉시 교체 (애니메이션 트윈 없음 — 타일 틴트와 달리 스프라이트 교체)
- 쓰러짐 애니메이션 중 나무 타일 충돌 즉시 해제 (애니메이션 중에도 통과 가능)
- 재생 애니메이션은 클라이언트 로컬 (타이머 기반, Firebase 동기화 불필요)
- 균열 오버레이는 채굴 중에만 표시, 채굴 취소 시 즉시 제거
- 건설 미리보기 깜빡임은 배치 불가 상태에서만 — 가능 상태는 정적 반투명
