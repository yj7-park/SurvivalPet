# 설계 48 — 타이틀 화면 & 캐릭터 생성 비주얼

> **전제 조건**: 01~47 단계 완료 상태.
> plan 19(타이틀·캐릭터 생성 기능), plan 40(캐릭터 스프라이트),
> plan 43(UI 색상 시스템), plan 44(화면 전환)를 기반으로
> 타이틀 화면과 캐릭터 생성 화면의 전체 비주얼을 확정한다.

---

## 1. 이번 단계 목표

1. **타이틀 배경** — 파노라마 맵 스크롤 + 낮/밤 사이클 연출
2. **타이틀 로고** — BASECAMP 텍스트 + 장식 비주얼
3. **메인 메뉴 UI** — 버튼 레이아웃 & 애니메이션
4. **캐릭터 생성 화면** — 스킨 미리보기, 능력치 바, 이름 입력
5. **씨드 입력 UI** — 씨드 패널 외형 & 맵 프리뷰 썸네일

---

## 2. 타이틀 배경

### 2-1. 파노라마 배경 맵

```typescript
// plan 19: 고정 씨드로 생성된 배경 맵이 천천히 좌→우 스크롤
// 스크롤 속도: 0.4px/s (매우 느리게)
// 맵 렌더: 타일 + 나무 오브젝트 (캐릭터·UI 없음)

class TitleBackground {
  private bgMaps: Phaser.GameObjects.Container[];  // 2개 연결해 무한 스크롤
  private scrollX = 0;

  update(delta: number): void {
    this.scrollX += 0.4 * (delta / 1000);
    this.bgMaps.forEach((m, i) => {
      m.x = -this.scrollX % 3200 + i * 3200;
    });
  }
}
```

### 2-2. 하늘 배경 그라디언트

```typescript
// 화면 상단 1/3을 하늘 그라디언트로 채움
// 시간은 실제 시각 기반 (로컬 시간 → 게임 내 시간 매핑)
// 낮/밤이 서서히 바뀌어 매번 다른 분위기

function drawTitleSky(ctx: CanvasRenderingContext2D, hour: number): void {
  const colors = getTitleSkyColors(hour);   // { top, bottom }
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, colors.top);
  grad.addColorStop(1, colors.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 200);
}

const TITLE_SKY: Record<'dawn'|'day'|'dusk'|'night', { top: string; bottom: string }> = {
  dawn:  { top: '#1a0a2a', bottom: '#e06828' },   // 보라→오렌지
  day:   { top: '#4a90d0', bottom: '#8ec8f0' },   // 하늘
  dusk:  { top: '#1a1040', bottom: '#c05020' },   // 남색→붉은 노을
  night: { top: '#050510', bottom: '#0a0818' },   // 칠흑
};
```

### 2-3. 타이틀 전경 장식

맵 스크롤 앞에 고정 오브젝트 레이어 (parallax 깊이감):

```
Depth 레이어:
  0: 하늘 (고정)
  1: 먼 산 실루엣 (매우 느리게 스크롤, ×0.1)
  2: 배경 맵 (스크롤 ×0.4)
  3: 전경 나무 실루엣 (빠르게 스크롤, ×1.2)
  4: 지면 풀 레이어 (가장 빠름, ×1.5)
  5: UI 레이어
```

```typescript
// 전경 나무 실루엣 (검정, 화면 하단에 배치)
function drawTreeSilhouette(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.fillStyle = 'rgba(5, 8, 3, 0.85)';
  // 삼각형 나무 실루엣 (침엽수 느낌)
  [[x,0,14,30], [x+5,0,10,22], [x-4,0,10,25]].forEach(([cx,cy,w,h]) => {
    ctx.beginPath();
    ctx.moveTo(cx, 580); ctx.lineTo(cx - w/2, 580 - h);
    ctx.lineTo(cx + w/2, 580 - h); ctx.closePath();
    ctx.fill();
  });
}
```

---

## 3. 타이틀 로고

### 3-1. 로고 텍스처 생성

```typescript
// BASECAMP 로고: Canvas API로 생성 → Phaser 텍스처 등록
function drawTitleLogo(ctx: CanvasRenderingContext2D): void {
  // 1. 배경 장식: 로고 뒤 모닥불 불꽃 실루엣 (주황)
  ctx.fillStyle = 'rgba(200, 100, 20, 0.15)';
  ctx.beginPath();
  ctx.moveTo(200, 100); ctx.lineTo(160, 20); ctx.lineTo(200, 50);
  ctx.lineTo(200, 5);   ctx.lineTo(240, 50); ctx.lineTo(200, 10);
  ctx.closePath(); ctx.fill();

  // 2. 메인 텍스트 그림자 (3px 아래)
  ctx.font = 'bold 42px "Courier New", monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('BASECAMP', 203, 73);

  // 3. 메인 텍스트 (그라디언트: 상단 밝은 황금 → 하단 어두운 황금)
  const grad = ctx.createLinearGradient(0, 30, 0, 70);
  grad.addColorStop(0, '#ffe090');
  grad.addColorStop(0.5, '#e8a830');
  grad.addColorStop(1, '#b07020');
  ctx.fillStyle = grad;
  ctx.fillText('BASECAMP', 200, 70);

  // 4. 텍스트 외곽선 (얇게)
  ctx.strokeStyle = '#7a4a10';
  ctx.lineWidth = 1;
  ctx.strokeText('BASECAMP', 200, 70);

  // 5. 부제 텍스트
  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = '#a09070';
  ctx.fillText('생존 시뮬레이션', 200, 90);

  // 6. 로고 아래 장식 선
  ctx.strokeStyle = '#7a5a20';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 98); ctx.lineTo(320, 98); ctx.stroke();
  // 가운데 마름모 장식
  ctx.fillStyle = '#c89040';
  ctx.beginPath();
  ctx.moveTo(200, 93); ctx.lineTo(203, 98);
  ctx.lineTo(200, 103); ctx.lineTo(197, 98);
  ctx.closePath(); ctx.fill();
}
```

### 3-2. 로고 등장 애니메이션

```typescript
// 게임 최초 실행 또는 타이틀 씬 진입 시
function playLogoAnimation(logoImage: Phaser.GameObjects.Image): void {
  logoImage.setAlpha(0).setY(logoImage.y - 20);

  // 1. 페이드인 + 위에서 내려오기 (0.8초)
  scene.tweens.add({
    targets: logoImage,
    alpha: 1, y: logoImage.y + 20,
    duration: 800, ease: 'Quad.easeOut',
  });

  // 2. 0.8초 후: 황금 반짝임 파티클 (로고 주변 3~5개)
  scene.time.delayedCall(800, () => {
    for (let i = 0; i < 5; i++) {
      scene.time.delayedCall(i * 80, () => spawnLogoSparkle(logoImage));
    }
  });
}

function spawnLogoSparkle(logo: Phaser.GameObjects.Image): void {
  const x = logo.x + Phaser.Math.Between(-120, 120);
  const y = logo.y + Phaser.Math.Between(-30, 30);
  const spark = scene.add.star(x, y, 4, 2, 5, 0xffd060).setAlpha(0);
  scene.tweens.add({
    targets: spark,
    alpha: { from: 0, to: 0.9 },
    scale: { from: 0, to: 1.2 },
    duration: 200, yoyo: true,
    onComplete: () => spark.destroy(),
  });
}
```

---

## 4. 메인 메뉴 UI

### 4-1. 버튼 레이아웃

```
화면 중앙 하단:

         ┌─────────────────────────┐
         │   🗺  새 게임 시작       │   ← 주 버튼 (너비 220px)
         └─────────────────────────┘
         ┌─────────────────────────┐
         │   🔑  씨드로 참가        │
         └─────────────────────────┘
         ┌─────────────────────────┐
         │   ⚙  설정               │
         └─────────────────────────┘

버튼 크기: 220×38px, 간격 10px
위치: x 중앙, y: 화면 높이 × 0.62
```

### 4-2. 버튼 외형 & 호버 이펙트

```typescript
function drawMenuButton(
  gfx: Phaser.GameObjects.Graphics,
  text: Phaser.GameObjects.Text,
  x: number, y: number,
  state: 'idle' | 'hover' | 'press',
): void {
  const w = 220, h = 38;
  const bx = x - w / 2;

  // 상태별 색상
  const bg = { idle: 0x1e1408, hover: 0x3a2810, press: 0x5a3c18 }[state];
  const bd = { idle: 0x5a4020, hover: 0xa07030, press: 0xc09040 }[state];

  // 배경
  gfx.fillStyle(bg, 0.92);
  gfx.fillRoundedRect(bx, y, w, h, 6);

  // 좌측 장식 바 (hover/press 시 표시)
  if (state !== 'idle') {
    gfx.fillStyle(0xc09040, 1.0);
    gfx.fillRect(bx, y + 6, 3, h - 12);
  }

  // 테두리
  gfx.lineStyle(1, bd, 1.0);
  gfx.strokeRoundedRect(bx + 0.5, y + 0.5, w - 1, h - 1, 6);

  // 상단 하이라이트 (미세)
  gfx.fillStyle(0xffffff, 0.05);
  gfx.fillRoundedRect(bx + 1, y + 1, w - 2, h / 3, 5);

  // 호버 시 텍스트 약간 오른쪽으로
  text.setX(x + (state === 'idle' ? 0 : 4));
  text.setColor(state === 'idle' ? '#c0a878' : '#f0d090');
}
```

### 4-3. 버튼 등장 스태거 애니메이션

```typescript
// 로고 등장 후 0.4초 간격으로 버튼 순차 등장
menuButtons.forEach((btn, i) => {
  btn.setAlpha(0).setX(btn.x - 30);
  scene.tweens.add({
    targets: btn, alpha: 1, x: btn.x + 30,
    duration: 350, delay: 900 + i * 120,
    ease: 'Quad.easeOut',
  });
});
```

### 4-4. 배경 모닥불 파티클 (타이틀 장식)

```typescript
// 화면 하단 좌측에 작은 모닥불 파티클 (분위기용)
const campfireEmitter = scene.add.particles(120, 520, 'fx_raindrop', {
  tint: [0xff6600, 0xff9900, 0xffcc00],
  scale: { start: 1.2, end: 0 },
  alpha: { start: 0.8, end: 0 },
  speedY: { min: -60, max: -100 },
  speedX: { min: -10, max: 10 },
  lifespan: { min: 400, max: 700 },
  quantity: 1, frequency: 80,
  blendMode: Phaser.BlendModes.ADD,
});
```

---

## 5. 캐릭터 생성 화면

### 5-1. 전체 레이아웃

```
┌────────────────────────────────────────────────────────────────┐
│  ← 뒤로              캐릭터 만들기                              │
├───────────────────────────┬────────────────────────────────────┤
│                           │  이름: [____________]              │
│   [◀]  캐릭터 미리보기  [▶] │                                    │
│   (스킨 1/3)              │  능력치 배분  합계: 20             │
│                           │                                    │
│   ┌──────────────────┐    │  💪 힘(STR)    [──●──────]  5    │
│   │                  │    │  ⚡ 민첩(AGI)   [──●──────]  5    │
│   │  [캐릭터 스프라이트] │    │  ❤ 체력(CON)  [──●──────]  5    │
│   │   (64×64 확대)   │    │  🧠 지능(INT)   [──●──────]  5    │
│   │                  │    │                                    │
│   └──────────────────┘    │  랜덤  [🎲]                       │
│   스킨: 기본 / 금발 / 흑발  │                                    │
│                           │        [게임 시작]                  │
└───────────────────────────┴────────────────────────────────────┘
```

### 5-2. 캐릭터 미리보기

```typescript
// 캐릭터 미리보기: 스킨 스프라이트를 4× 확대 + 유휴 호흡 애니메이션
class CharacterPreview {
  private sprite: Phaser.GameObjects.Sprite;
  private backdrop: Phaser.GameObjects.Graphics;  // 배경 원

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // 배경 원 (어두운 원형 플랫폼)
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x1a1208, 0.85);
    this.backdrop.fillCircle(x, y + 20, 50);
    this.backdrop.fillStyle(0x2a1e10, 0.6);
    this.backdrop.fillEllipse(x, y + 38, 60, 12);  // 그림자

    // 캐릭터 (4× 스케일)
    this.sprite = scene.add.sprite(x, y, 'char_skin0').setScale(4);
    this.sprite.play('idle_down');
  }

  setSkin(skinId: 0 | 1 | 2): void {
    this.sprite.setTexture(`char_skin${skinId}`);
    this.sprite.play('idle_down');
  }

  // 스킨 전환 트윈: 오른쪽으로 슬라이드아웃 → 새 스킨 왼쪽에서 슬라이드인
  switchSkin(newSkinId: 0 | 1 | 2, dir: 'left' | 'right'): void {
    const dirX = dir === 'right' ? 60 : -60;
    scene.tweens.add({
      targets: this.sprite, x: this.sprite.x + dirX, alpha: 0,
      duration: 180, ease: 'Quad.easeIn',
      onComplete: () => {
        this.setSkin(newSkinId);
        this.sprite.setX(this.sprite.x - dirX * 2);
        scene.tweens.add({
          targets: this.sprite, x: this.sprite.x + dirX * 2, alpha: 1,
          duration: 180, ease: 'Quad.easeOut',
        });
      },
    });
  }
}
```

### 5-3. 능력치 슬라이더

```typescript
// 4개 슬라이더 (STR·AGI·CON·INT), 합계 20 고정
// 드래그 또는 ±버튼으로 조작

function drawStatBar(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number,
  value: number,        // 2~10
  statColor: number,
): void {
  const w = 120, h = 10;

  // 트랙
  gfx.fillStyle(0x1a1208, 0.9);
  gfx.fillRoundedRect(x, y, w, h, 4);

  // 채움 (최솟값 2 = 항상 일부 채워짐)
  const ratio = (value - 2) / 8;   // 0~1
  const fillW = Math.max(8, Math.floor(w * ratio));
  gfx.fillStyle(statColor, 0.4);
  gfx.fillRoundedRect(x, y, fillW, h, 4);
  gfx.fillStyle(statColor, 1.0);
  gfx.fillRoundedRect(x, y + 1, fillW, h - 3, 3);

  // 하이라이트
  gfx.fillStyle(0xffffff, 0.15);
  gfx.fillRoundedRect(x + 1, y + 1, fillW - 2, 3, 2);

  // 테두리
  gfx.lineStyle(1, 0x3a2a14, 0.9);
  gfx.strokeRoundedRect(x, y, w, h, 4);
}

const STAT_COLORS: Record<string, number> = {
  STR: 0xe85030,   // 빨강 (힘)
  AGI: 0x30e860,   // 초록 (민첩)
  CON: 0x3080e8,   // 파랑 (체력)
  INT: 0xe0a830,   // 황금 (지능)
};
```

### 5-4. 능력치 변경 시 미리보기 반응

```typescript
// STR 증가 → 캐릭터 팔이 살짝 강조 (스프라이트 수정 없이 색조로 표현)
function onStatChanged(stat: 'STR'|'AGI'|'CON'|'INT', newVal: number): void {
  // 수치 변화 팝업 (+1 / -1)
  const delta = newVal - prevVal;
  const popup = scene.add.text(sliderX + 140, sliderY, delta > 0 ? `+${delta}` : `${delta}`, {
    fontSize: '12px', fontFamily: 'Courier New',
    color: delta > 0 ? '#88ff88' : '#ff8888',
    stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5);
  scene.tweens.add({
    targets: popup, y: popup.y - 14, alpha: 0,
    duration: 500, ease: 'Quad.easeOut',
    onComplete: () => popup.destroy(),
  });

  // 합계가 20을 초과하면 슬라이더 빨간색 펄스 경고
  if (totalStats > 20) {
    scene.tweens.add({
      targets: totalText,
      tint: { from: 0xff4444, to: 0xf0e0c8 },
      duration: 400,
    });
  }
}
```

---

## 6. 씨드 입력 UI

### 6-1. 씨드 패널

```
┌────────────────────────────────────┐
│  씨드 입력                    [✕]  │
├────────────────────────────────────┤
│  씨드: [  abc123  ]  [🎲 랜덤]    │
│                                    │
│  ┌──────────────────────────┐      │
│  │   맵 미리보기            │      │
│  │  (80×80px 픽셀 썸네일)   │      │
│  │                          │      │
│  └──────────────────────────┘      │
│  씨드: abc123  봄 시작             │
│                                    │
│              [이 씨드로 참가]       │
└────────────────────────────────────┘
```

### 6-2. 맵 미리보기 썸네일

```typescript
// 씨드 입력 완료(Enter 또는 0.5초 디바운스) 시 80×80px 썸네일 생성
// 맵 100×100 타일 → 80×80px (각 타일 약 0.8px)
function generateMapThumbnail(seed: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 80;
  const ctx = canvas.getContext('2d')!;

  const mapData = generateMap(seed, 5, 5);  // 월드 중앙 맵 샘플
  const scale = 80 / 100;

  mapData.tiles.forEach((row, ty) => {
    row.forEach((tile, tx) => {
      ctx.fillStyle = MINIMAP_COLORS_HEX[tile];
      ctx.fillRect(Math.floor(tx * scale), Math.floor(ty * scale),
        Math.ceil(scale), Math.ceil(scale));
    });
  });

  // 테두리
  ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 80, 80);
  return canvas;
}

const MINIMAP_COLORS_HEX: Record<TileType, string> = {
  dirt:  '#b89060',
  water: '#4a88c0',
  rock:  '#707878',
  tree:  '#3a6820',
};
```

---

## 7. 파티클 & 주변 연출

### 7-1. 타이틀 화면 반딧불 (밤 시간대)

```typescript
// 실제 시각이 밤(20:00~06:00)일 때 반딧불 파티클 표시
if (isNightTime()) {
  scene.add.particles(0, 0, 'fx_snowflake', {
    x: { min: 0, max: 800 },
    y: { min: 300, max: 580 },
    tint: 0xccffaa,           // 연두 (반딧불)
    scale: { min: 0.3, max: 0.7 },
    alpha: { start: 0, end: 0, ease: 'Sine.easeInOut' },   // yoyo로 깜빡임
    lifespan: { min: 2000, max: 4000 },
    quantity: 1, frequency: 800,
    moveToX: { min: 0, max: 800 },  // 천천히 이동
    moveToY: { min: 300, max: 580 },
    blendMode: Phaser.BlendModes.ADD,
  });
}
```

### 7-2. 하단 풀 흔들림

```typescript
// 전경 풀 레이어에 바람 흔들림 (plan 09 나무 바람과 동일 패턴)
grassSprites.forEach((g, i) => {
  scene.tweens.add({
    targets: g,
    angle: Phaser.Math.Between(-3, 3),
    duration: 1500 + i * 200,
    yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut',
  });
});
```

---

## 8. TitleScene 렌더링 순서

```
Depth  0: 하늘 그라디언트 레이어
Depth  1: 별 레이어 (야간, plan 44)
Depth  2: 먼 산 실루엣 (parallax ×0.1)
Depth  3: 배경 맵 타일 (plan 41 TileRenderer)
Depth  4: 배경 나무 (plan 42 TreeRenderer)
Depth  5: 모닥불 파티클
Depth  6: 전경 나무 실루엣 (어둡게)
Depth  7: 전경 풀
Depth  8: 반딧불 파티클 (야간)
Depth 10: 로고
Depth 11: 메인 메뉴 버튼
Depth 12: 씨드 패널 / 캐릭터 생성 패널 (오버레이)
Depth 20: 화면 전환 오버레이
```

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/scenes/TitleScene.ts` | 파노라마 배경, 로고, 메뉴 버튼, 반딧불, parallax |
| `src/ui/TitleMenu.ts` | 신규: 메뉴 버튼 렌더링 & 호버 이펙트 |
| `src/ui/CharacterCreationPanel.ts` | 미리보기, 스킨 전환, 능력치 슬라이더 |
| `src/ui/SeedPanel.ts` | 신규: 씨드 입력 + 맵 썸네일 |
| `src/world/SpriteGenerator.ts` | 타이틀 로고 텍스처 생성 로직 추가 |

---

## 10. 확정 규칙

- 타이틀 배경 맵은 `seed = 'title_bg_v1'` 고정 씨드 (업데이트 시 변경 가능)
- 파노라마 스크롤은 우→좌 방향, 2개 맵을 이어 무한 반복
- 캐릭터 미리보기: idle_down 애니메이션 고정 (방향 변경 없음)
- 맵 썸네일 생성: 씨드 입력 후 0.5초 디바운스 (매 키 입력마다 재계산 방지)
- 능력치 합계 20 초과 시 [게임 시작] 버튼 비활성 + 빨간 경고
- 반딧불 파티클: 실제 로컬 시간 기준 야간(20:00~06:00)에만 표시
- 타이틀 → 게임 씬 전환: plan 44의 흰색 플래시 전환 그대로 사용
