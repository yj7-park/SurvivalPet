# 설계 39 — 농업 시스템

> **전제 조건**: 01~38 단계 완료 상태.
> CookingSystem(plan 13), HungerSystem(plan 24), SpriteGenerator,
> WeatherSystem(plan 08), SeasonSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **밭 만들기** — 괭이로 흙 타일을 경작지로 변환
2. **씨앗 시스템** — 씨앗 아이템 획득·심기
3. **작물 성장** — 시간·계절·날씨 기반 성장 단계
4. **수확** — 완숙 작물 클릭으로 수확, 씨앗 일부 회수
5. **요리 연동** — 수확물을 조리대·모닥불에서 조리

---

## 2. 경작지 (Farmland)

### 2-1. 밭 만들기

새 아이템 **괭이(Hoe)** 추가:
```
제작 (작업대, crafting Lv.1):
  목재 ×3  →  괭이 ×1
```

사용 방법:
```
인벤토리에서 괭이 선택 → [사용하기]
  → 커서 모드 진입 (건설 배치와 유사)
  → 흙 타일 클릭 → 즉시 경작지 타일로 변환
  → 타일 당 괭이 내구도 -1 (최대 내구도 30)
```

경작지 제약:
- 흙 타일에만 가능 (물·암반·나무 위 불가)
- 건설물 위 불가 (모닥불·작업대 등 설치 타일 불가)
- 경작지는 타일을 차지하므로 그 위에 건설 불가

### 2-2. 경작지 타일 상태

| 상태 | 스프라이트 키 | 설명 |
|------|------------|------|
| 건조 경작지 | `farmland_dry` | 물 안 준 상태 |
| 촉촉한 경작지 | `farmland_wet` | 비/물뿌리개 후 |
| 작물 성장 단계 | `crop_{type}_{stage}` | 씨앗~완숙 |
| 수확 완료 | `farmland_wet` | 수확 후 촉촉 상태 복귀 |

촉촉한 상태 지속:
- 비가 오는 날: 자동 촉촉 유지
- 물뿌리개 사용: 1게임일(30분 현실) 지속
- 촉촉하지 않으면 성장 속도 50% 감소

### 2-3. 물뿌리개

```
제작 (작업대, crafting Lv.1):
  목재 ×4  →  물뿌리개 ×1  (내구도 20)

사용: 물 타일 인접 → 물뿌리개 채우기 (5회 분)
     경작지 타일 클릭 → 물 주기 (1회 소모)
```

---

## 3. 씨앗 시스템

### 3-1. 씨앗 종류

| 씨앗 | 획득 방법 | 재배 계절 | 성장 기간 | 수확물 |
|------|---------|---------|---------|--------|
| 밀 씨앗 | 야생 밀 수확, 드랍 | 봄·여름·가을 | 2게임일 | 밀 ×3~5 |
| 감자 씨앗 | 감자 드랍, 상점 | 봄·가을 | 3게임일 | 감자 ×2~4 |
| 당근 씨앗 | 드랍 | 봄·여름 | 2게임일 | 당근 ×2~3 |
| 호박 씨앗 | 드랍 | 여름 | 4게임일 | 호박 ×1~2 |

> 게임일 = 현실 30분

씨앗 획득:
- 야생 작물(맵 생성 시 일부 흙 타일에 배치) 수확 시 씨앗 + 식재료 동시 획득
- 적 드랍 테이블(plan 16)에 씨앗 추가 (침략자 5% 확률)

### 3-2. 씨앗 심기

```
씨앗 아이템 선택 → [심기]
  → 경작지 타일 클릭 → 즉시 파종
  → 씨앗 1개 소모
  → 성장 단계 0 시작
```

경작지 1타일에 씨앗 1개만 심을 수 있음.

---

## 4. 작물 성장

### 4-1. 성장 단계

모든 작물 공통 3단계:

| 단계 | 이름 | 외형 |
|------|------|------|
| 0 | 파종 | 작은 새싹 |
| 1 | 성장 중 | 중간 크기 줄기 |
| 2 | 완숙 | 완전히 자란 상태 (수확 가능) |

```typescript
const GROWTH_TICKS_PER_STAGE: Record<CropType, number> = {
  wheat:   1,   // 게임일당 1틱 → 2틱 = 2게임일
  potato:  1,
  carrot:  1,
  pumpkin: 1,
};
// 틱은 게임일 경과 시 증가 (TimeSystem onDayEnd 이벤트 활용)
```

### 4-2. 성장 조건

```typescript
function tickGrowth(crop: Crop, weather: WeatherType, season: Season): void {
  // 비 적합 계절이면 성장 없음
  if (!CROP_SEASONS[crop.type].includes(season)) return;

  // 촉촉함 여부
  const wetMultiplier = crop.tile.isWet ? 1.0 : 0.5;

  // 날씨 보정
  const weatherBonus: Partial<Record<WeatherType, number>> = {
    rain: 1.3,   // 비: 30% 빠름
    snow: 0.0,   // 눈: 성장 완전 정지
    blizzard: 0.0,
  };
  const weatherMult = weatherBonus[weather] ?? 1.0;

  crop.growthProgress += wetMultiplier * weatherMult;
  if (crop.growthProgress >= 1.0) {
    crop.growthProgress = 0;
    crop.stage = Math.min(crop.stage + 1, 2);
  }
}
```

### 4-3. 완숙 알림

작물이 stage 2 도달 시:
```
notifySystem.show('🌾 [밀] 수확 가능합니다', 'success')
```

---

## 5. 수확

### 5-1. 수확 방법

```
완숙 작물 클릭 (48px 이내)
  → 컨텍스트 메뉴:
      [🌾 수확하기]
  → 즉시 수확 (진행 바 없음)
  → 수확물 인벤토리 추가
  → 씨앗 1~2개 추가 확률 (50%)
  → 경작지 타일은 촉촉한 상태로 복귀 (재파종 가능)
```

### 5-2. 수확량 계산

```typescript
function calculateYield(crop: Crop, stats: CharacterStats): number {
  const [min, max] = CROP_YIELD[crop.type];   // 예: [3, 5]
  const base = Phaser.Math.Between(min, max);
  // STR 높을수록 수확량 소폭 증가
  const bonus = Math.floor((stats.str - 5) * 0.3);
  return Math.max(min, base + bonus);
}
```

### 5-3. 숙련도 연동

수확 1회 → `farming +10` XP (새 숙련도 카테고리)

farming 숙련도 레벨 효과:

| 레벨 | 효과 |
|------|------|
| Lv.1 | 기본 |
| Lv.3 | 씨앗 회수 확률 +20% |
| Lv.5 | 수확량 +1 보장 |
| Lv.7 | 성장 속도 +10% |
| Lv.10 | 두 배 수확 확률 10% |

---

## 6. 작물 요리 레시피

### 6-1. 조리대 레시피 추가 (plan 13 확장)

| 레시피 | 재료 | 산출 | 허기 회복 | HP 회복 | 소요 시간 |
|--------|------|------|---------|--------|---------|
| 밀빵 | 밀 ×3 | 밀빵 ×1 | +35 | 0 | 15초 |
| 감자 스프 | 감자 ×2, 물고기 ×1 | 감자 스프 ×1 | +45 | +15 | 20초 |
| 당근 스튜 | 당근 ×3, 날고기 ×1 | 당근 스튜 ×1 | +50 | +25 | 20초 |
| 호박죽 | 호박 ×1 | 호박죽 ×2 | +30 | +10 | 15초 |

### 6-2. 모닥불 요리 (plan 36 확장)

모닥불에서는 **구운 감자**만 추가:

| 레시피 | 재료 | 산출 | 소요 시간 |
|--------|------|------|---------|
| 감자 굽기 | 감자 ×1 | 구운 감자 ×1 | 10초 |

구운 감자: 허기 +20, HP 0

---

## 7. 야생 작물 맵 생성

### 7-1. 맵 생성 시 야생 작물 배치 (MapGenerator 확장)

```typescript
// 각 맵에 씨앗·야생 작물 소량 배치
const WILD_CROP_DENSITY = 0.02;   // 흙 타일의 2%

// 계절별 야생 작물 종류
const WILD_CROPS_BY_SEASON: Record<Season, CropType[]> = {
  spring: ['wheat', 'carrot'],
  summer: ['wheat', 'carrot', 'pumpkin'],
  autumn: ['wheat', 'potato'],
  winter: [],   // 겨울에는 야생 작물 없음
};
```

야생 작물은 경작지가 아닌 일반 흙 타일에 배치 — 수확하면 씨앗 + 식재료 획득, 재생성 없음.

---

## 8. 멀티플레이 연동

### 8-1. Firebase 저장 구조

```
/rooms/{seed}/farms/{mapKey}/
  {tileKey}/              (예: "50_60")
    ├── type: CropType
    ├── stage: 0 | 1 | 2
    ├── growthProgress: number
    ├── isWet: boolean
    ├── wetUntil: number    // Date.now() + 지속 ms
    └── plantedBy: string
```

동기화 정책:
- 파종·수확 이벤트: 즉시 Firebase 업데이트
- 성장 틱: 로컬 계산, 하루 1회 동기화 (onDayEnd 이벤트)
- 물 주기: 즉시 Firebase 업데이트

---

## 9. 스프라이트 추가

SpriteGenerator에 추가:

| 키 | 크기 | 설명 |
|----|------|------|
| `farmland_dry` | 32×32 | 건조 경작지 (갈색 줄무늬) |
| `farmland_wet` | 32×32 | 촉촉한 경작지 (진한 갈색) |
| `crop_wheat_0~2` | 32×32 | 밀 3단계 |
| `crop_potato_0~2` | 32×32 | 감자 3단계 |
| `crop_carrot_0~2` | 32×32 | 당근 3단계 |
| `crop_pumpkin_0~2` | 32×32 | 호박 3단계 |
| `item_hoe` | 16×16 | 괭이 아이템 |
| `item_watering_can` | 16×16 | 물뿌리개 아이템 |
| `item_wheat` | 16×16 | 밀 식재료 |
| `item_potato` | 16×16 | 감자 식재료 |
| `item_carrot` | 16×16 | 당근 식재료 |
| `item_pumpkin` | 16×16 | 호박 식재료 |

---

## 10. FarmingSystem 클래스

```typescript
export class FarmingSystem {
  private crops: Map<string, Crop>;   // key: "mapX_mapY_tileX_tileY"

  // 경작지 변환 (괭이 사용 시)
  till(tileX: number, tileY: number): void

  // 파종
  plant(tileKey: string, seedType: CropType, inventory: Inventory): void

  // 물 주기
  water(tileKey: string, inventory: Inventory): void

  // 수확
  harvest(tileKey: string, inventory: Inventory, stats: CharacterStats): void

  // 매 프레임
  update(delta: number): void

  // 하루 경과 시 성장 틱
  onDayEnd(weather: WeatherType, season: Season): void

  // 수확 가능 여부
  isReadyToHarvest(tileKey: string): boolean
}

interface Crop {
  tileKey: string;
  type: CropType;
  stage: 0 | 1 | 2;
  growthProgress: number;
  isWet: boolean;
  wetUntil: number;
}
```

---

## 11. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/FarmingSystem.ts` | 신규: 경작·파종·성장·수확 전체 관리 |
| `src/world/MapGenerator.ts` | 야생 작물 배치 로직 추가 |
| `src/config/crops.ts` | 신규: 작물 정의 (성장 기간·수확량·계절) |
| `src/config/recipes.ts` | 작물 조리 레시피 4종 추가 |
| `src/config/items.ts` | 괭이·물뿌리개·작물 식재료 아이템 추가 |
| `src/systems/ProficiencySystem.ts` | farming 숙련도 카테고리 추가 |
| `src/scenes/GameScene.ts` | FarmingSystem 통합, onDayEnd 연결 |
| `src/systems/MultiplayerSystem.ts` | farms 컬렉션 리스너 등록 |
| `src/world/SpriteGenerator.ts` | 작물·농기구 스프라이트 추가 |
| `src/systems/SaveSystem.ts` | farmland 타일 저장 (싱글: localStorage) |

---

## 12. 확정 규칙

- 비적합 계절에 심은 씨앗은 성장하지 않음 (파종은 가능, 경고 표시)
- 경작지 위를 플레이어가 통과 가능 (이동 차단 없음)
- 작물 수확 후 경작지 타일은 유지 (흙으로 되돌아가지 않음)
- 내구도 시스템(plan 22) 괭이·물뿌리개에 적용, 0이 되면 파괴
- 야생 작물은 한 맵에 최대 10개, 수확 후 재생성 없음
- farming 숙련도 XP는 수확 1회 기준 — 파종·물 주기에는 XP 없음
- 겨울에는 모든 경작지 작물 성장 완전 정지 (촉촉함 유지해도 무효)
