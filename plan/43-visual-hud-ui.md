# 설계 43 — HUD & UI 비주얼 테마

> **전제 조건**: 01~42 단계 완료 상태.
> plan 34(HUD 생존 게이지), plan 32(횃불 게이지), plan 37(토스트·ESC 메뉴),
> plan 07(인벤토리)에서 기능만 정의된 UI 요소의 외형을 이번 단계에서 확정한다.

---

## 1. 이번 단계 목표

1. **UI 색상 시스템** — 전체 UI에 통일된 색상·폰트·테두리 규칙
2. **HUD 생존 게이지** — 3종 게이지 외형 확정 (HP·허기·피로·행동)
3. **인벤토리 패널** — 슬롯 그리드, 아이템 아이콘, 수량 표시 외형
4. **건설·제작·요리 패널** — 탭 UI, 카드형 레시피 목록
5. **컨텍스트 메뉴** — 우클릭/탭 메뉴 외형
6. **미니맵** — 픽셀 스타일 지형 미니맵 외형

---

## 2. UI 색상 시스템 (Design Token)

모든 UI가 공유하는 기준 상수:

```typescript
export const UI_COLORS = {
  // 패널 배경
  panelBg:        'rgba(18, 14, 10, 0.88)',   // 거의 검정, 약간 갈색
  panelBorder:    '#5a4428',                   // 나무색 테두리
  panelBorderHi:  '#8a6840',                   // 호버/선택 테두리

  // 슬롯
  slotBg:         'rgba(40, 30, 18, 0.90)',
  slotBorder:     '#3a2a14',
  slotHover:      '#6a4a28',
  slotSelected:   '#a06828',

  // 텍스트
  textPrimary:    '#f0e0c8',                   // 크림색 (기본)
  textSecondary:  '#a09070',                   // 회갈색 (보조)
  textDisabled:   '#504030',
  textDanger:     '#ff6666',
  textSuccess:    '#66cc66',
  textWarning:    '#ffcc44',

  // 게이지
  gaugeHp:        '#e84040',                   // HP 빨강
  gaugeHpLow:     '#ff8080',                   // HP 낮을 때 밝아짐
  gaugeHunger:    '#e8a030',                   // 허기 주황
  gaugeFatigue:   '#4088e8',                   // 피로 파랑
  gaugeAction:    '#a060e8',                   // 행동 보라
  gaugeTorch:     '#e8a820',                   // 횃불 황금
  gaugeBg:        'rgba(10, 8, 6, 0.80)',

  // 버튼
  btnBg:          'rgba(60, 44, 24, 0.90)',
  btnBgHover:     'rgba(90, 66, 36, 0.95)',
  btnBgActive:    'rgba(120, 90, 50, 1.0)',
  btnBorder:      '#7a5a30',
};

export const UI_FONT = {
  primary:   '11px "Courier New", monospace',
  heading:   'bold 13px "Courier New", monospace',
  small:     '10px "Courier New", monospace',
  large:     'bold 16px "Courier New", monospace',
};
```

---

## 3. HUD 생존 게이지

### 3-1. 레이아웃 (화면 좌상단)

```
┌─────────────────────────────────────────┐
│  ❤  [██████████████░░░░]  84           │  HP
│  🍖 [████████░░░░░░░░░░]  52           │  허기
│  😴 [██████████░░░░░░░░]  66           │  피로
│  ⚡  [████░░░░░░░░░░░░░░]  28           │  행동
└─────────────────────────────────────────┘
  x: 12px, y: 12px
  게이지 너비: 120px, 높이: 8px
  게이지 간격: 16px
```

### 3-2. 게이지 드로잉 (Phaser Graphics)

```typescript
function drawGauge(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number,
  value: number, maxValue: number,
  color: number, width = 120, height = 8,
): void {
  const ratio = value / maxValue;

  // 배경 트랙
  gfx.fillStyle(0x0a0806, 0.80);
  gfx.fillRoundedRect(x, y, width, height, 3);

  // 채워진 부분 (색상 그라디언트 근사: 2단계)
  const fillW = Math.floor(width * ratio);
  if (fillW > 0) {
    gfx.fillStyle(color, 0.55);                       // 어두운 레이어 (깊이감)
    gfx.fillRoundedRect(x, y, fillW, height, 3);
    gfx.fillStyle(color, 1.0);                        // 밝은 메인 레이어
    gfx.fillRoundedRect(x, y + 1, fillW, height - 3, 2);
    // 하이라이트 (상단 1px 흰 줄)
    gfx.fillStyle(0xffffff, 0.18);
    gfx.fillRect(x + 2, y + 1, fillW - 4, 1);
  }

  // 테두리
  gfx.lineStyle(1, 0x3a2a14, 0.9);
  gfx.strokeRoundedRect(x, y, width, height, 3);

  // 위험 깜빡임 (value ≤ 20%)
  if (ratio <= 0.2) {
    const pulse = Math.sin(Date.now() * 0.006) * 0.3 + 0.7;
    gfx.fillStyle(0xffffff, pulse * 0.15);
    gfx.fillRoundedRect(x, y, fillW, height, 3);
  }
}
```

### 3-3. 수치 텍스트

```typescript
// 게이지 오른쪽에 숫자 표시
const valueText = scene.add.text(x + width + 6, y - 1,
  String(Math.ceil(value)), {
    fontSize: '10px', fontFamily: 'Courier New',
    color: ratio <= 0.2 ? '#ff6666' : '#a09070',
  });
```

### 3-4. 횃불 게이지 (우상단, plan 32)

```
🔦 [████████░░]  8:24
   너비 80px, 황금색, 우상단 x: 화면폭-100, y: 14
```

시간 표시: `MM:SS` 형식, 30초 이하 시 빨간색 깜빡임

---

## 4. 인벤토리 패널

### 4-1. 패널 외형

```
┌──────────────────────────────────────────┐  ← 패널 테두리: #5a4428
│  🎒 인벤토리                        [✕]  │  ← 헤더 (높이 28px)
├──────────────────────────────────────────┤
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   │
│  │🪵│ │🪨│ │🐟│ │  │ │  │ │  │ │  │   │  ← 7열 × 4행 슬롯
│  │×9│ │×3│ │×1│ │  │ │  │ │  │ │  │   │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘   │
│  ┌──┐ ┌──┐  ...                         │
│  ...                                     │
├──────────────────────────────────────────┤
│  무게: 12/50  [정렬]                     │  ← 하단 정보
└──────────────────────────────────────────┘
  패널 크기: 280×240px
  슬롯 크기: 36×36px, 간격: 4px
```

### 4-2. 슬롯 드로잉

```typescript
function drawSlot(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number,
  state: 'normal' | 'hover' | 'selected' | 'empty',
): void {
  const size = 36;

  // 배경
  const bgColor = {
    normal:   0x281e12, hover:    0x4a3218,
    selected: 0x7a5020, empty:    0x1e1610,
  }[state];
  gfx.fillStyle(bgColor, 0.92);
  gfx.fillRoundedRect(x, y, size, size, 4);

  // 내부 그라디언트 (상단 약간 밝게)
  gfx.fillStyle(0xffffff, 0.04);
  gfx.fillRoundedRect(x + 1, y + 1, size - 2, 8, 2);

  // 테두리
  const borderColor = {
    normal: 0x3a2a14, hover: 0x6a4a28,
    selected: 0xaa7830, empty: 0x2a1e0e,
  }[state];
  gfx.lineStyle(1, borderColor, 1.0);
  gfx.strokeRoundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 4);

  // hover 시 모서리 하이라이트
  if (state === 'hover' || state === 'selected') {
    gfx.lineStyle(1, 0xffffff, 0.12);
    gfx.strokeRoundedRect(x + 1, y + 1, size - 2, size - 2, 3);
  }
}
```

### 4-3. 아이템 수량 배지

```typescript
// 슬롯 우하단 수량 표시
if (count > 1) {
  // 어두운 배경 뱃지
  gfx.fillStyle(0x000000, 0.70);
  gfx.fillRoundedRect(x + 22, y + 24, 13, 11, 2);
  scene.add.text(x + 24, y + 25, String(count), {
    fontSize: '9px', fontFamily: 'Courier New',
    color: '#f0e0c8',
  });
}
```

---

## 5. 건설·제작·요리 패널

### 5-1. 탭 UI

```
┌─[목재]──[석재]──[기타]──────────────────┐
│  탭 선택: 하단 2px 강조선 (#a06828)      │
│  미선택 탭: textSecondary (#a09070)      │
```

### 5-2. 레시피 카드

```
┌──────────────────────────────────────┐
│  🧱 목재 벽                           │
│  목재 ×5          ⏱ 5초   [건설하기] │
│  ████████░░  재료 충분                │
└──────────────────────────────────────┘

카드 높이: 52px
재료 충분: 초록 텍스트 / 부족: 빨간 텍스트 + 버튼 비활성
```

```typescript
function drawRecipeCard(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number, width: number,
  selected: boolean,
): void {
  // 배경
  gfx.fillStyle(selected ? 0x3a2a14 : 0x221810, 0.95);
  gfx.fillRoundedRect(x, y, width, 52, 5);
  // 좌측 강조 바 (선택 시)
  if (selected) {
    gfx.fillStyle(0xa06828, 1.0);
    gfx.fillRect(x, y + 4, 3, 44);
  }
  // 테두리
  gfx.lineStyle(1, selected ? 0x8a6030 : 0x2e2010, 1.0);
  gfx.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, 51, 5);
}
```

---

## 6. 컨텍스트 메뉴

```
┌──────────────────┐
│  🪓 벌목하기     │  ← 기본 액션 (흰색)
│  👀 살펴보기     │
│  ─────────────── │  ← 구분선
│  ✕ 취소          │  ← 회색
└──────────────────┘
  너비: 140px, 항목 높이: 28px
  위치: 클릭 좌표 기준, 화면 밖 넘치면 방향 반전
```

```typescript
// 항목 호버 시 배경 하이라이트
function drawContextItem(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number, width: number,
  hovered: boolean,
): void {
  if (hovered) {
    gfx.fillStyle(0x6a4a28, 0.80);
    gfx.fillRoundedRect(x + 2, y + 1, width - 4, 26, 3);
  }
}
```

---

## 7. 미니맵 (M 키, plan 21)

### 7-1. 외형

```
┌──────────────────────────────────┐
│  지도  [봄 3일]             [✕]  │  ← 헤더
├──────────────────────────────────┤
│  ┌────────────────────────┐      │
│  │ ░░░░░░██░░░░░░░░░░░   │      │  ← 10×10 월드 그리드
│  │ ░░░░████░░░░░░░░░░░   │      │    각 맵 = 10×10px
│  │ ░░░░░░░░░░░░░░░░░░░   │      │
│  │ ░░░░░░░░░●░░░░░░░░░   │      │  ← ● = 현재 위치
│  └────────────────────────┘      │
│  현재 맵: (3, 4)                  │
└──────────────────────────────────┘
```

### 7-2. 타일 색상 (픽셀 단위)

```typescript
// 미니맵 픽셀 색상 (방문한 맵의 타일 샘플링)
const MINIMAP_COLORS: Record<TileType, number> = {
  dirt:  0xb89060,
  water: 0x4a88c0,
  rock:  0x808080,
  tree:  0x3a7020,   // 나무가 밀집한 흙 타일
};

// 미탐험 맵: 완전 검정 (0x000000)
// 탐험한 맵: 지형 색 (타일 비율 기준 혼합색)
// 현재 맵: 밝은 테두리 (0xffd060)
// 플레이어 위치: 흰색 점 (2×2px)
```

---

## 8. 툴팁 공통 스타일

마우스 호버 시 나타나는 툴팁:

```
┌────────────────────────────┐
│  목재                      │  ← 아이템명 (크림색 bold)
│  건설·제작 재료             │  ← 설명 (회갈색)
│  보유: 12개                 │  ← 수량 (보조색)
└────────────────────────────┘
  최대 너비: 180px
  배경: rgba(12,9,6,0.95)
  테두리: 1px solid #5a4428
  출현: 호버 0.4초 후 표시 (즉시 표시 방지)
  퇴장: 즉시
```

---

## 9. UIRenderer 클래스

```typescript
export class UIRenderer {
  // 공통 패널 배경 그리기
  static drawPanel(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    options?: { title?: string; closable?: boolean }
  ): void

  // 버튼
  static drawButton(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    label: string, state: 'normal' | 'hover' | 'active' | 'disabled',
  ): void

  // 게이지
  static drawGauge(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, value: number, max: number,
    color: number, width?: number,
  ): void

  // 슬롯
  static drawSlot(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    state: 'normal' | 'hover' | 'selected' | 'empty',
  ): void

  // 툴팁
  static showTooltip(
    scene: Phaser.Scene,
    x: number, y: number,
    lines: { text: string; color?: string }[],
  ): void
}
```

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/ui/UIRenderer.ts` | 신규: 공통 드로잉 유틸리티 (패널·게이지·슬롯·버튼) |
| `src/config/uiColors.ts` | 신규: UI_COLORS, UI_FONT 상수 |
| `src/ui/HUD.ts` | UIRenderer 기반으로 게이지 재구현 |
| `src/ui/InventoryPanel.ts` | 슬롯 그리드·아이템 배지 외형 적용 |
| `src/ui/BuildPanel.ts` | 탭 UI·레시피 카드 외형 적용 |
| `src/ui/CraftPanel.ts` | 레시피 카드 외형 통일 |
| `src/ui/CookingPanel.ts` | 레시피 카드 외형 통일 |
| `src/ui/ContextMenu.ts` | 컨텍스트 메뉴 외형 적용 |
| `src/ui/MiniMap.ts` | 픽셀 미니맵 렌더링 |
| `src/ui/Tooltip.ts` | 신규: 공통 툴팁 컴포넌트 |

---

## 11. 확정 규칙

- 모든 UI는 `UI_COLORS` / `UI_FONT` 상수만 참조 — 하드코딩 금지
- 패널 열기 애니메이션: `scaleY 0→1`, 0.12초, `Cubic.easeOut` (빠르고 경쾌하게)
- 패널 닫기 애니메이션: `alpha 1→0`, 0.08초 (거의 즉시)
- 버튼 호버: 배경색 전환 0.1초 (Phaser tween)
- 게이지 수치 변화: 즉시 반영 (트윈 없음 — 생존 게임에서 정확한 수치 우선)
- 툴팁 딜레이: 호버 400ms 후 표시 (버튼 위 빠른 마우스 이동 시 툴팁 난발 방지)
- 미니맵 탐험 기록: localStorage `sv_explored_{seed}` 에 저장 (재접속 후 유지)
