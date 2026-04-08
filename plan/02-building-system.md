# 설계 02 — 건설 시스템 · 아이템 · 스프라이트

> **전제 조건**: `game-plan.md` 기준의 1단계 작업이 완료된 상태.
> 즉, 맵 렌더링(흙/물/암반/나무), 캐릭터 4방향 이동, 기본 상호작용
> (벌목·낚시·채굴 프로그레스 바), 캐릭터 능력치·상태 수치가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. 새로 추가되는 **아이템·구조물 스프라이트** 생성 (`sprite-generator.html` 확장)
2. **건설 시스템 (B 키)** 전체 동작 구현
3. **작업대·조리대** 상호작용 UI 구현
4. **내구도 시스템** 기초 구현

---

## 2. 추가 스프라이트 목록

모든 스프라이트는 기존 방침대로 **Canvas API 코드로 생성** (`sprite-generator.html`에 추가).
외부 PNG 파일 사용 금지.

### 2-1. 아이템 아이콘 (32×32, 인벤토리·UI용)

| 키 | 이름 | 설명 |
|----|------|------|
| `item_stone` | 암석 | 불규칙한 회색 덩어리 |
| `item_processed_stone` | 석재 | 정돈된 직사각형 돌블록, 밝은 회색 |
| `item_wood` | 목재 | 갈색 나무 판자 2~3개 묶음 |
| `item_fish` | 물고기 | 주황빛 물고기 실루엣 |
| `item_cooked_fish` | 요리된 음식 | 접시 위 구운 생선 |

### 2-2. 구조물 타일 (32×32, 맵 위에 표시, 탑다운 뷰)

| 키 | 이름 | 재질 변형 | 비고 |
|----|------|-----------|------|
| `struct_wall_wood` | 목재 벽 | — | 갈색 두꺼운 테두리 |
| `struct_wall_stone` | 석재 벽 | — | 회색, 벽돌 패턴 |
| `struct_door_wood` | 목재 문 | — | 벽 중앙에 문 틈 표현 |
| `struct_door_stone` | 석재 문 | — | 석재 문틀 |
| `struct_roof_wood` | 목재 지붕 | — | 어두운 갈색 대각 패턴 |
| `struct_roof_stone` | 석재 지붕 | — | 짙은 회색 슬레이트 패턴 |
| `struct_bed_wood` | 목재 침대 | — | 탑다운: 베개+이불 |
| `struct_bed_stone` | 석재 침대 | — | 탑다운: 석재 프레임+매트 |
| `struct_table_wood` | 목재 식탁 | — | 탑다운: 4각 테이블 |
| `struct_table_stone` | 석재 식탁 | — | 탑다운: 석재 슬랩 테이블 |
| `struct_chair_wood` | 목재 의자 | — | 탑다운: 작은 사각형+등받이 |
| `struct_chair_stone` | 석재 의자 | — | 탑다운: 석재 스툴 |
| `struct_workbench_wood` | 목재 작업대 | — | 탑다운: 테이블+공구 실루엣 |
| `struct_workbench_stone` | 석재 작업대 | — | 탑다운: 석재 테이블+공구 |
| `struct_kitchen_wood` | 목재 조리대 | — | 탑다운: 테이블+냄비 |
| `struct_kitchen_stone` | 석재 조리대 | — | 탑다운: 석재+냄비 |

### 2-3. 스프라이트 드로잉 규칙

```
공통:
- 32×32 캔버스, 배경 투명
- 픽셀아트 스타일 (image-rendering: pixelated)
- 목재 계열 색상: #a0622a (어둠) / #c8884a (기본) / #e0aa6a (하이라이트)
- 석재 계열 색상: #6b6b6b (어둠) / #909090 (기본) / #b8b8b8 (하이라이트)
- 탑다운 구조물: 상단에 약간 밝은 면, 우하단에 그림자선 (2px)
```

---

## 3. 건설 시스템 동작 설계

### 3-1. 흐름 개요

```
[B 키 입력]
    │
    ▼
건설 패널 표시 (우측 하단)
    │
    ▼
항목 클릭 → 재료 확인
    ├── 재료 부족 → 항목 비활성화 표시 (회색 + 필요 재료 툴팁)
    └── 재료 충분 → 설치 모드 진입
            │
            ▼
        마우스로 설치 위치 지정
            ├── 설치 가능한 타일: 초록 반투명 프리뷰
            └── 설치 불가 타일: 빨간 반투명 프리뷰
            │
            ▼
        좌클릭 → 재료 차감 + 프로그레스 바 시작
            │
            ▼
        완료 → 구조물 배치
        (우클릭 or B 키 → 설치 모드 취소)
```

### 3-2. 설치 가능 조건

| 구조물 | 설치 가능 타일 | 제한 |
|--------|---------------|------|
| 벽 | 흙 | 같은 위치에 다른 구조물 없을 것 |
| 문 | 흙 | 인접 4방향 중 벽이 1개 이상 |
| 지붕 | 흙 | 인접 4방향 중 벽 또는 지붕이 1개 이상 |
| 침대/식탁/의자/작업대/조리대 | 흙 | 지붕 없어도 설치 가능 |

### 3-3. 건설 소요 시간

```
build_time_wood  = base_time
build_time_stone = base_time × 2

base_time 기준 (STR 5 기준):
  벽:       3초
  문:       2초
  지붕:     4초
  침대:     5초
  식탁:     4초
  의자:     2초
  작업대:   6초
  조리대:   6초

STR 영향:
  actual_time = base_time - (STR - 5) * 0.3  (최소 1초)
```

### 3-4. 건설 패널 UI 레이아웃

```
┌─────────────────────────────┐
│  🔨 건설                   │  ← 패널 헤더
├────────────┬────────────────┤
│  목재 탭  │   석재 탭      │  ← 재질 탭
├────────────┴────────────────┤
│ [벽]  [문]  [지붕]         │
│ [침대] [식탁] [의자]       │  ← 건설 항목 격자
│ [작업대] [조리대]          │
├─────────────────────────────┤
│ 선택: 목재 벽              │
│ 필요: 목재 ×5  보유: ×12  │  ← 선택 항목 정보
└─────────────────────────────┘
위치: 화면 우측 하단 고정, B 키 토글
```

---

## 4. 작업대 · 조리대 상호작용

### 4-1. 작업대 (제작 UI)

- 작업대 클릭 → 제작 패널 열림
- 제작 목록:

| 제작 결과 | 필요 재료 | 소요 시간 | 관여 능력치 |
|-----------|-----------|-----------|-------------|
| 석재 ×1 | 암석 ×5 | INT 기반 | INT 높을수록 빠름 |

```
craft_time = 6 - (INT - 5) * 0.4  (초, 최소 2초)
```

- 제작 중 프로그레스 바 표시 (작업대 위)
- 제작 취소 가능 (이동 or ESC)

### 4-2. 조리대 (요리 UI)

- 조리대 클릭 → 요리 패널 열림
- 요리 목록:

| 요리 결과 | 필요 재료 | 소요 시간 | 허기 회복량 |
|-----------|-----------|-----------|-------------|
| 구운 생선 ×1 | 물고기 ×1 | INT 기반 | +35 |

```
cook_time = 8 - (INT - 5) * 0.4  (초, 최소 3초)
```

---

## 5. 내구도 시스템

### 5-1. 기본 수치

| 구조물 | 목재 내구도 | 석재 내구도 |
|--------|-------------|-------------|
| 벽 | 100 | 300 |
| 문 | 80 | 240 |
| 지붕 | 120 | 360 |
| 침대 | 60 | 180 |
| 식탁 | 60 | 180 |
| 의자 | 40 | 120 |
| 작업대 | 80 | 240 |
| 조리대 | 80 | 240 |

### 5-2. 내구도 감소

| 원인 | 감소량 |
|------|--------|
| 시간 경과 | -1 / 게임 내 1일 |
| 광란 모드 자동 공격 | -10 / 타격 |
| 전투 피해 (추후) | 별도 설계 |

### 5-3. 내구도 표시

- 구조물 호버 시 체력바처럼 구조물 위에 표시
  - 80% 이상: 초록
  - 40~80%: 노랑
  - 40% 미만: 빨강

### 5-4. 수리

- 구조물 클릭 → "🔧 수리하기" 액션 표시
- 수리 재료: 건설 재료의 50% (소수점 올림)
- 완료 시 내구도 **100%** 회복
- 수리 소요 시간: 건설 시간의 50%

### 5-5. 파괴

- 내구도 0 → 구조물 제거
- 재료 **50%** 드롭 (바닥 아이템으로 생성, 클릭으로 줍기)

---

## 6. 바닥 아이템 (드롭 아이템)

- 파괴된 구조물 또는 미래 몬스터 드롭으로 바닥에 아이템 생성
- 시각: 32×32 아이템 아이콘 + 주변 반짝임 효과
- 줍기: 아이템 위를 지나가면 자동 획득 (별도 클릭 불필요)
- 30분(현실 시간) 후 자동 소멸

---

## 7. sprite-generator.html 업데이트 지침

기존 `sprite-generator.html`에 아래 섹션을 추가한다.

```
[아이템 아이콘 섹션]
  drawStoneItem()         → 'item_stone'
  drawProcessedStone()    → 'item_processed_stone'
  drawWoodItem()          → 'item_wood'
  drawFish()              → 'item_fish'
  drawCookedFish()        → 'item_cooked_fish'

[구조물 섹션 — 목재]
  drawWallWood()          → 'struct_wall_wood'
  drawDoorWood()          → 'struct_door_wood'
  drawRoofWood()          → 'struct_roof_wood'
  drawBedWood()           → 'struct_bed_wood'
  drawTableWood()         → 'struct_table_wood'
  drawChairWood()         → 'struct_chair_wood'
  drawWorkbenchWood()     → 'struct_workbench_wood'
  drawKitchenWood()       → 'struct_kitchen_wood'

[구조물 섹션 — 석재]
  (목재 함수와 동일 구조, 색상만 석재 팔레트로 교체)
```

각 함수는 `makeCanvas(32, 32)`로 캔버스 생성 후 탑다운 뷰로 드로잉.
완성 후 `addCard()`로 프리뷰 카드에 추가.

---

## 8. Phaser 등록 키 목록 (이번 단계 추가분)

```typescript
// preload()에서 추가 등록
createItemTexture('item_stone');
createItemTexture('item_processed_stone');
createItemTexture('item_wood');
createItemTexture('item_fish');
createItemTexture('item_cooked_fish');

createStructTexture('struct_wall_wood');
createStructTexture('struct_wall_stone');
createStructTexture('struct_door_wood');
createStructTexture('struct_door_stone');
createStructTexture('struct_roof_wood');
createStructTexture('struct_roof_stone');
createStructTexture('struct_bed_wood');
createStructTexture('struct_bed_stone');
createStructTexture('struct_table_wood');
createStructTexture('struct_table_stone');
createStructTexture('struct_chair_wood');
createStructTexture('struct_chair_stone');
createStructTexture('struct_workbench_wood');
createStructTexture('struct_workbench_stone');
createStructTexture('struct_kitchen_wood');
createStructTexture('struct_kitchen_stone');
```
