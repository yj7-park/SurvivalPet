# 설계 21 — 맵 전환 시스템

> **전제 조건**: 01~20 단계 완료 상태.
> 맵 생성(plan 02), MultiplayerSystem(plan 20), SaveSystem(plan 17)이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **맵 경계 감지** — 플레이어가 맵 끝(100×100 타일)을 벗어날 때 감지
2. **인접 맵 사전 생성** — 현재 맵 주변 맵을 백그라운드에서 미리 생성
3. **맵 전환 실행** — 언로드 → 로드 → 플레이어 좌표 재배치
4. **부드러운 전환 연출** — 페이드 아웃/인 또는 슬라이드
5. **멀티플레이 연동** — 맵 이동 시 Firebase 좌표 갱신

---

## 2. 월드 구조 복습

```
전체 월드: 10×10 맵 그리드 (mapX: 0~9, mapY: 0~9)
각 맵: 100×100 타일 (타일 크기: 32px → 맵 1개 = 3200×3200px)
월드 최외곽: mapX/mapY 0 또는 9의 맵 끝 = 세계 끝 (이동 불가)
```

---

## 3. 맵 경계 감지

### 3-1. 경계 감지 조건

```typescript
const TILE_SIZE = 32;
const MAP_TILES = 100;
const MAP_PX = TILE_SIZE * MAP_TILES; // 3200px

function checkMapExit(px: number, py: number, mapX: number, mapY: number): ExitDirection | null {
  if (py < 0           && mapY > 0) return 'north';
  if (py >= MAP_PX     && mapY < 9) return 'south';
  if (px < 0           && mapX > 0) return 'west';
  if (px >= MAP_PX     && mapX < 9) return 'east';
  // 세계 끝(맵 0 또는 9의 경계)은 이동 불가 — 벽처럼 막음
  return null;
}

type ExitDirection = 'north' | 'south' | 'east' | 'west';
```

### 3-2. 세계 끝 처리

맵 (0,*), (9,*), (*,0), (*,9) 의 바깥 경계:
- 이동 불가 (타일 이동 차단과 동일하게 처리)
- 호버 툴팁: "세계의 끝입니다"

---

## 4. 인접 맵 사전 생성 (Preload)

### 4-1. 사전 생성 대상

현재 맵 (cx, cy) 기준으로 인접 8방향 + 현재 = 최대 9개 맵 관리:

```
(cx-1,cy-1) (cx,cy-1) (cx+1,cy-1)
(cx-1,cy  ) (cx,cy  ) (cx+1,cy  )   ← 현재 맵
(cx-1,cy+1) (cx,cy+1) (cx+1,cy+1)
```

월드 경계 바깥 맵(음수, 10 이상)은 생성하지 않음.

### 4-2. MapCache

```typescript
export class MapCache {
  // key: `${mapX},${mapY}`
  private cache: Map<string, MapData>;
  private generating: Set<string>;

  // 동기 조회 (캐시 히트)
  get(mapX: number, mapY: number): MapData | null

  // 비동기 생성 요청 (Worker 또는 idle 프레임)
  requestGenerate(mapX: number, mapY: number, seed: string): void

  // 현재 맵 변경 시 캐시 정리 (불필요한 맵 제거)
  evict(currentMapX: number, currentMapY: number): void

  // 캐시 유지 개수: 최대 9개 (3×3 그리드)
}
```

### 4-3. 생성 전략

맵 생성은 메인 스레드에서 처리하되 **프레임 분산**:
- `requestAnimationFrame` idle 시간 또는 Phaser의 `time.addEvent` 로 분할
- 맵 1개 생성을 **10프레임에 걸쳐** 분산 (높이맵 → 타일 분류 → 강 → 나무 순)
- 전환 직전(경계 32px 이내 진입)에도 목적지 맵이 미생성이면 즉시 동기 생성

```typescript
// 경계 접근 감지 → 사전 생성 트리거
const PRELOAD_THRESHOLD = 32 * 5; // 5타일 전부터 사전 생성
if (px < PRELOAD_THRESHOLD) mapCache.requestGenerate(mapX - 1, mapY, seed);
if (px > MAP_PX - PRELOAD_THRESHOLD) mapCache.requestGenerate(mapX + 1, mapY, seed);
// 남북도 동일
```

---

## 5. 맵 전환 실행

### 5-1. 전환 흐름

```
플레이어가 경계 초과 감지 (ExitDirection)
  → 전환 잠금 (입력 차단, 중복 전환 방지)
  → 페이드 아웃 (0.3초)
  → 새 mapX/mapY 계산
  → MapCache.get() 으로 목적지 맵 데이터 확인
      캐시 미스: 동기 생성 (로딩 스피너 표시)
  → 현재 맵 렌더링 오브젝트 전부 제거
  → 목적지 맵 렌더링 초기화
  → 플레이어 좌표 재계산 (반대쪽 끝으로 이동)
  → 자동 저장 (plan 17 — 맵 전환 트리거)
  → Firebase 좌표 업데이트 (plan 20)
  → 페이드 인 (0.3초)
  → 전환 잠금 해제
```

### 5-2. 플레이어 도착 좌표 계산

```typescript
function calcArrivalPos(exitDir: ExitDirection, px: number, py: number): { x: number; y: number } {
  switch (exitDir) {
    case 'east':  return { x: 1,           y: py };         // 서쪽 끝 1px
    case 'west':  return { x: MAP_PX - 2,  y: py };         // 동쪽 끝 1px
    case 'south': return { x: px,           y: 1 };          // 북쪽 끝 1px
    case 'north': return { x: px,           y: MAP_PX - 2 }; // 남쪽 끝 1px
  }
}
```

### 5-3. 페이드 연출

```typescript
// Phaser Camera fade
this.cameras.main.fadeOut(300, 0, 0, 0);           // 검정으로 페이드 아웃
this.cameras.main.once('camerafadeoutcomplete', () => {
  // 맵 교체 작업
  this.cameras.main.fadeIn(300, 0, 0, 0);          // 검정에서 페이드 인
});
```

---

## 6. 맵 렌더링 초기화/해제

### 6-1. 렌더링 레이어 구조

```
TileLayer    (Phaser TilemapLayer — 타일 지형)
ObjectLayer  (나무, 암반 오브젝트 스프라이트 그룹)
BuildingLayer (건설물 스프라이트 그룹)
EntityLayer  (플레이어, 적, 지면 아이템)
```

### 6-2. 맵 해제

```typescript
function unloadCurrentMap(): void {
  tileLayer.destroy();
  objectGroup.clear(true, true);    // 스프라이트 destroy 포함
  buildingGroup.clear(true, true);
  enemyGroup.clear(true, true);
  groundItemGroup.clear(true, true);
  // 적 AI, 지면 아이템 등 시스템 상태 초기화
}
```

### 6-3. 맵 로드

```typescript
function loadMap(mapData: MapData, buildings: BuildingSaveEntry[]): void {
  // 1. 타일맵 생성
  renderTiles(mapData.tiles);
  // 2. 나무/암반 오브젝트 배치
  renderObjects(mapData.objects, saveData.world);
  // 3. 건설물 복원 (현재 맵 좌표에 해당하는 것만)
  buildings
    .filter(b => b.mapX === currentMapX && b.mapY === currentMapY)
    .forEach(b => buildingSystem.restore(b));
  // 4. 적 스폰 (plan 06 로직 재사용)
  enemySpawner.spawnForMap(currentMapX, currentMapY, seed);
}
```

---

## 7. 맵별 독립 상태 관리

### 7-1. 맵 상태 범위

| 상태 | 범위 | 처리 방식 |
|------|------|---------|
| 타일 지형 | 맵 단위 | 맵 전환 시 재생성 |
| 나무/암반 오브젝트 | 맵 단위 | SaveData의 `cutTrees`, `minedRocks`로 복원 |
| 건설물 | 맵 단위 필터링 | `mapX, mapY` 필드로 구분 |
| 적 | 맵 단위 | 전환 시 파괴·재스폰 |
| 지면 드랍 아이템 | 맵 단위 | 전환 시 소멸 (저장 안 함, plan 16 규칙) |
| 플레이어 상태 | 전역 | 전환 시 유지 |

### 7-2. 적 상태 처리

맵 떠날 때:
- 현재 맵의 모든 적 **파괴** (전투 중이라도)
- 진행 중인 전투 즉시 종료, 데미지 없음

맵 돌아올 때:
- 적 재스폰 (seed + mapX + mapY 기반 — 항상 동일한 위치/종류)
- 단, 처치된 적은 `killedEnemies: Set<string>` 에 저장해 재스폰 제외
  - key: `${mapX},${mapY},${enemyId}`
  - 이 데이터는 `WorldSaveData`에 포함 (plan 17 확장)

---

## 8. 미니맵 (선택 사항 — 이번 단계 포함)

화면 우상단에 10×10 월드 미니맵:

```
┌──────────┐
│□□□□□□□□□□│
│□□□□★□□□□□│  ← ★: 현재 위치
│□□□□□□□□□□│
│          │  (10×10 픽셀 그리드, 각 맵 = 6×6px)
└──────────┘
```

- M 키로 표시/숨김
- 방문한 맵: 어두운 녹색 (#3a5f3a)
- 미방문 맵: 검정 (#111)
- 현재 맵: 밝은 녹색 + 깜빡임

방문 기록:
```typescript
// WorldSaveData에 추가
visitedMaps: Array<[number, number]>;   // [mapX, mapY] 쌍 목록
```

---

## 9. MapTransitionSystem 클래스

```typescript
export class MapTransitionSystem {
  private transitioning: boolean = false;
  private mapCache: MapCache;

  constructor(scene: GameScene, seed: string) {}

  // 매 프레임 호출 — 경계 감지 및 사전 생성 트리거
  update(px: number, py: number, mapX: number, mapY: number): void

  // 전환 실행 (내부 호출)
  private async transition(dir: ExitDirection): Promise<void>

  // 현재 맵 데이터 조회
  getCurrentMap(): MapData

  // 사전 생성 상태 조회 (로딩 UI용)
  isPrecaching(): boolean
}
```

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/MapTransitionSystem.ts` | 신규: 경계 감지·전환 실행 |
| `src/systems/MapCache.ts` | 신규: 맵 데이터 캐시·사전 생성 |
| `src/scenes/GameScene.ts` | MapTransitionSystem 통합, 맵 로드/해제 |
| `src/world/MapGenerator.ts` | 비동기 분할 생성 지원 추가 |
| `src/systems/EnemySpawner.ts` | 맵 전환 시 재스폰 로직 |
| `src/systems/SaveSystem.ts` | `killedEnemies`, `visitedMaps` 직렬화 추가 |
| `src/ui/HUD.ts` | 미니맵 오버레이 추가 (M 키) |
| `src/systems/MultiplayerSystem.ts` | 맵 전환 시 Firebase 좌표 즉시 업로드 |

---

## 11. 확정 규칙

- 전환 중(페이드 0.6초) 키보드·마우스 입력 완전 차단
- 동시에 2개 방향 경계 초과(코너) 시: x축 이동 우선 처리 (동/서 우선)
- 적과 전투 중 맵 전환 시: 전투 즉시 종료, 받던 데미지 없음 (도망 허용)
- 멀티플레이에서 서로 다른 맵에 있는 플레이어는 렌더링하지 않음 (plan 20 규칙)
- 맵 생성 실패(예외 발생) 시: 빈 맵(전체 흙) 으로 폴백, 콘솔 경고
- 세계 끝(맵 그리드 외곽) 도달 시 이동 차단 — "더 이상 갈 수 없습니다" 메시지 1회
