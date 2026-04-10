# 설계 17 — 저장 / 불러오기 시스템

> **전제 조건**: 01~16 단계 완료 상태.
> Inventory, ProficiencySystem, EquipmentSystem, CharacterStats, BuildSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **자동 저장(AutoSave)** — 일정 주기마다 게임 상태를 localStorage에 저장
2. **수동 저장** — 메뉴에서 즉시 저장
3. **불러오기** — 저장 슬롯에서 재개
4. **저장 슬롯 3개** — 독립적인 플레이스루 관리
5. **저장 데이터 구조** 확정 — 모든 시스템 상태 직렬화

---

## 2. 저장 데이터 구조

### 2-1. 최상위 SaveData

```typescript
export interface SaveData {
  version: number;          // 현재: 1 (마이그레이션용)
  savedAt: number;          // Date.now()
  playtime: number;         // 총 플레이 시간 (ms)
  seed: string;             // 월드 seed

  character: CharacterSaveData;
  world: WorldSaveData;
  settings: SettingsSaveData;
}
```

### 2-2. 캐릭터 저장 데이터

```typescript
export interface CharacterSaveData {
  // 위치
  mapX: number;             // 현재 맵 좌표 (0~9)
  mapY: number;
  x: number;                // 타일 내 픽셀 좌표
  y: number;

  // 기본 능력치 (고정값 — 캐릭터 생성 시 결정)
  stats: {
    str: number; agi: number; con: number; int: number;
  };

  // 상태 수치
  hp: number;
  hunger: number;           // 0~100
  fatigue: number;          // 0~100
  action: number;           // 0~100

  // 인벤토리
  inventory: InventorySaveData;

  // 장비
  equipment: {
    weapon: string | null;
    armor: string | null;
    shield: string | null;
  };

  // 숙련도
  proficiency: Record<ProficiencyType, { level: number; xp: number; totalXp: number }>;

  // 해금 상태
  unlockedResearch: string[];       // ResearchSystem 완료 목록
  knownRecipes: string[];           // 레시피 아이템으로 해금
  knownBlueprints: string[];        // 도면 아이템으로 해금
}
```

### 2-3. 인벤토리 저장 데이터

```typescript
export interface InventorySaveData {
  slots: Array<{ itemId: string; amount: number } | null>;
  // 슬롯 수는 현재 구현 기준 (ex: 20슬롯)
}
```

### 2-4. 월드 저장 데이터

```typescript
export interface WorldSaveData {
  // 건설물 (seed로 재생성되지 않는 플레이어 배치 구조물)
  buildings: BuildingSaveEntry[];

  // 채굴된 암반 (영구 소모 — seed 재생성 시 복원 안 함)
  minedRocks: Array<{ mapX: number; mapY: number; tileX: number; tileY: number }>;

  // 벌목된 나무 (일정 시간 후 재생 — 재생 시각 저장)
  cutTrees: Array<{
    mapX: number; mapY: number; tileX: number; tileY: number;
    regrowAt: number;         // Date.now() 기준 절대 시각
  }>;

  // 게임 내 시간
  gameTime: {
    day: number;
    timeOfDay: number;        // 0~86400 (게임 내 초)
    realElapsedMs: number;    // 현실 경과 시간 (ms)
  };
}

export interface BuildingSaveEntry {
  id: string;
  type: string;               // 'wall_wood', 'bed_stone' 등
  mapX: number; mapY: number;
  tileX: number; tileY: number;
  durability: number;
  material: 'wood' | 'stone';
}
```

### 2-5. 설정 저장 데이터

```typescript
export interface SettingsSaveData {
  autoPickup: boolean;        // 자동 픽업 설정
  masterVolume: number;       // 0.0~1.0 (추후 사운드)
}
```

---

## 3. 저장 슬롯 시스템

### 3-1. localStorage 키 구조

```
localStorage keys:
  'sv_slot_0'   → SaveData JSON (슬롯 0)
  'sv_slot_1'   → SaveData JSON (슬롯 1)
  'sv_slot_2'   → SaveData JSON (슬롯 2)
  'sv_meta'     → SlotMeta[] JSON (슬롯 목록 미리보기)
```

### 3-2. 슬롯 메타데이터 (빠른 목록 표시용)

```typescript
export interface SlotMeta {
  slot: number;
  occupied: boolean;
  savedAt: number;
  playtime: number;
  seed: string;
  day: number;           // 게임 내 날짜
  thumbnail?: string;    // 추후: Canvas 스냅샷 base64 (선택 사항)
}
```

---

## 4. SaveSystem 클래스

```typescript
export class SaveSystem {
  // 저장
  save(slot: number, gameState: GameState): SaveResult
  saveAuto(gameState: GameState): void          // 마지막으로 사용한 슬롯에 저장

  // 불러오기
  load(slot: number): SaveData | null
  hasSave(slot: number): boolean
  getSlotMeta(): SlotMeta[]

  // 삭제
  deleteSave(slot: number): void

  // 버전 마이그레이션
  migrate(data: unknown): SaveData              // 구버전 데이터 → 최신 구조 변환

  // 직렬화 헬퍼
  private serialize(gameState: GameState): SaveData
  private deserialize(data: SaveData): GameState
}

type SaveResult = { ok: true } | { ok: false; reason: string };
```

---

## 5. 자동 저장 (AutoSave)

### 5-1. 트리거 조건

| 트리거 | 설명 |
|--------|------|
| 시간 주기 | 현실 시간 **5분**마다 자동 저장 |
| 맵 전환 시 | 다른 맵으로 이동할 때 |
| 수면 완료 시 | 침대에서 일어날 때 |
| 브라우저 탭 닫기 전 | `beforeunload` 이벤트 |

### 5-2. 자동 저장 알림

```
화면 우상단에 2초간 표시:
  "💾 자동 저장됨"  (14px, 흰색, 반투명 검정 배경)
  → 페이드인 0.3s → 1.4s 유지 → 페이드아웃 0.3s
```

저장 실패 시 (localStorage 용량 초과 등):
```
  "⚠ 자동 저장 실패 — 저장 공간을 확인하세요"  (노란색)
```

---

## 6. 저장/불러오기 UI

### 6-1. ESC 메뉴에 저장 항목 추가

```
┌──────────────────────┐
│       일시정지        │
├──────────────────────┤
│  [저장하기]          │
│  [불러오기]          │
│  [설정]              │
│  [타이틀로]          │
└──────────────────────┘
```

### 6-2. 저장 슬롯 선택 패널

```
┌─────────────────────────────────────────┐
│  저장 슬롯 선택                    [✕]  │
├─────────────────────────────────────────┤
│  슬롯 1  │ 3일차 │ 02:14:05 │ seed:abc │
│           │                  [저장] [삭제]│
├─────────────────────────────────────────┤
│  슬롯 2  │ (비어 있음)                  │
│           │                     [저장]   │
├─────────────────────────────────────────┤
│  슬롯 3  │ 1일차 │ 00:32:11 │ seed:xyz │
│           │                  [저장] [삭제]│
└─────────────────────────────────────────┘
```

### 6-3. 불러오기 패널 (타이틀에서도 동일)

```
┌─────────────────────────────────────────┐
│  게임 불러오기                     [✕]  │
├─────────────────────────────────────────┤
│  슬롯 1  │ 3일차 │ 2시간 14분           │
│           │ 저장: 2026-04-10 14:32      │
│           │                   [불러오기] │
├─────────────────────────────────────────┤
│  슬롯 2  │ (비어 있음)                  │
├─────────────────────────────────────────┤
│  슬롯 3  │ 1일차 │ 32분                 │
│           │ 저장: 2026-04-10 09:11      │
│           │                   [불러오기] │
└─────────────────────────────────────────┘
```

### 6-4. 덮어쓰기 확인

이미 저장된 슬롯에 저장 시:
```
"슬롯 1의 저장 데이터를 덮어쓰시겠습니까?
 (3일차, 02:14:05)"
  [확인]  [취소]
```

---

## 7. 불러오기 흐름

```
[불러오기] 클릭
  → SaveSystem.load(slot) 호출
  → SaveData.version 확인 → 필요 시 migrate()
  → GameScene 초기화:
    1. seed로 맵 재생성 (deterministic)
    2. 채굴된 암반 타일 적용
    3. 벌목 나무 상태 적용 (regrowAt 미래면 빈 타일)
    4. 건설물 복원
    5. 캐릭터 위치·스탯·인벤토리·장비·숙련도 복원
    6. 게임 시간 복원
  → 로딩 화면 → GameScene 시작
```

---

## 8. 버전 마이그레이션

```typescript
function migrate(raw: unknown): SaveData {
  const data = raw as { version?: number };

  // v0 → v1: proficiency 필드 추가 (구버전에 없을 수 있음)
  if (!data.version || data.version < 1) {
    // proficiency 기본값 삽입
    (data as any).character.proficiency = DEFAULT_PROFICIENCY;
    (data as any).version = 1;
  }

  return data as SaveData;
}
```

규칙:
- 버전 불일치 시 **경고 표시 후 불러오기 진행** (강제 차단 안 함)
- 복구 불가능한 버전 차이 시에만 "저장 데이터가 너무 오래되어 불러올 수 없습니다" 표시

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/SaveSystem.ts` | 신규: 저장/불러오기 전체 로직 |
| `src/scenes/GameScene.ts` | AutoSave 타이머, beforeunload 등록, 불러오기 복원 |
| `src/scenes/TitleScene.ts` | 슬롯 선택 → 불러오기 진입 |
| `src/ui/PauseMenu.ts` | 신규: ESC 메뉴 (저장·불러오기·설정·타이틀) |
| `src/ui/SaveSlotPanel.ts` | 신규: 슬롯 선택·저장·삭제 패널 |
| `src/ui/LoadSlotPanel.ts` | 신규: 슬롯 선택·불러오기 패널 |

---

## 10. 확정 규칙

- localStorage 저장 공간 초과(~5MB) 시: 가장 오래된 슬롯 데이터 경고 후 사용자 결정
- 멀티플레이 모드에서는 저장/불러오기 비활성 (Firebase 상태가 단일 진실 소스)
- 지면 아이템(GroundItem)은 저장하지 않음 — 임시 상태로 간주
- 연구 진행 중 상태(`ResearchSystem.currentResearch`)는 저장 안 함 — 재개 시 초기화
- 저장 파일 암호화·무결성 검증 없음 (단순 JSON — 멀티에서 검증은 서버 담당)
