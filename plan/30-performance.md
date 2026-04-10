# 설계 30 — 성능 최적화

> **전제 조건**: 01~29 단계 완료 상태.
> Phaser.js 렌더링, MapGenerator, 모든 게임 시스템이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **타일 컬링** — 화면 밖 타일 렌더링 제거
2. **오브젝트 풀링** — 스프라이트 재사용으로 GC 압력 감소
3. **맵 생성 최적화** — 청크 단위 분할 생성, 메인 스레드 점유 최소화
4. **Firebase 쓰기 최소화** — 배치 업데이트·스로틀링
5. **FPS 모니터링** — 개발 모드 성능 지표 표시
6. **목표 성능 기준** — 달성해야 할 수치 확정

---

## 2. 목표 성능 기준

| 지표 | 목표 | 측정 환경 |
|------|------|---------|
| 초기 로딩 | ≤ 3초 | Chrome, 일반 노트북, 캐시 없음 |
| 맵 전환 시간 | ≤ 0.5초 | 사전 생성 캐시 히트 기준 |
| 게임 루프 FPS | 60fps (최소 30fps) | 플레이어 4명, 적 10마리 |
| 메모리 사용 | ≤ 300MB | 장시간 플레이 후 |
| Firebase 쓰기 | ≤ 20회/초 | 플레이어 1명 기준 |

---

## 3. 타일 컬링 (Tile Culling)

### 3-1. 문제

맵 1개 = 100×100 = 10,000 타일. 전부 렌더링 시 불필요한 드로우콜 발생.

### 3-2. Phaser Tilemap 자동 컬링 활용

Phaser의 `StaticTilemapLayer`는 카메라 기준 자동 컬링을 지원:
```typescript
const layer = map.createStaticLayer('tiles', tileset, 0, 0);
layer.setCullPadding(1, 1);   // 화면 외곽 1타일 여유 컬링
// → 화면에 보이는 타일만 자동 렌더링
```

추가 설정:
```typescript
// 타일 배치 후 정적 레이어로 고정 (동적 변경 없는 지형)
layer.setDepth(0);
// 카메라 이동에 맞춰 자동 컬링 → 개발자 직접 구현 불필요
```

### 3-3. 오브젝트(나무·암반) 컬링

Phaser Group의 카메라 컬링 활성:
```typescript
objectGroup.children.each((obj: Phaser.GameObjects.Sprite) => {
  // Phaser 기본: 카메라 밖 오브젝트는 자동으로 렌더링 스킵
  obj.setActive(true).setVisible(true);
});
// 별도 컬링 코드 불필요 — Phaser 카메라가 처리
```

수동 컬링이 필요한 경우 (지면 아이템 등 동적 오브젝트):
```typescript
function cullObjects(
  objects: Phaser.GameObjects.Sprite[],
  camera: Phaser.Cameras.Scene2D.Camera
): void {
  const { x, y, width, height } = camera.worldView;
  const pad = 64; // px 여유
  for (const obj of objects) {
    const visible =
      obj.x > x - pad && obj.x < x + width + pad &&
      obj.y > y - pad && obj.y < y + height + pad;
    obj.setVisible(visible);
  }
}
// GameScene.update()에서 매 프레임이 아닌 카메라 이동 시에만 호출
```

---

## 4. 오브젝트 풀링 (Object Pooling)

### 4-1. 적용 대상

| 대상 | 이유 |
|------|------|
| 데미지 팝업 텍스트 | 전투 중 빈번한 생성·소멸 |
| 지면 드랍 아이템 스프라이트 | 적 처치 시 다수 생성 |
| 파티클(먼지, 피격 이펙트) | 이펙트 다수 동시 발생 |
| 적 스프라이트 | 맵 전환 시 재생성 빈번 |

### 4-2. Phaser Group 풀링 패턴

```typescript
// 풀 생성 (미리 N개 비활성 상태로 준비)
export class SpritePool<T extends Phaser.GameObjects.Sprite> {
  private pool: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene, classType: new (...args: any[]) => T, size: number) {
    this.pool = scene.add.group({
      classType,
      maxSize: size,
      runChildUpdate: false,
    });
    // 미리 size개 생성 후 비활성화
    this.pool.createMultiple({ quantity: size, active: false, visible: false });
  }

  acquire(x: number, y: number): T | null {
    const obj = this.pool.getFirstDead(false) as T | null;
    if (!obj) return null;   // 풀 소진 시 null 반환
    obj.setPosition(x, y).setActive(true).setVisible(true);
    return obj;
  }

  release(obj: T): void {
    obj.setActive(false).setVisible(false);
  }
}

// 사용 예시 (데미지 팝업)
const popupPool = new SpritePool(scene, DamageText, 20);
// 피격 시
const popup = popupPool.acquire(x, y);
if (popup) popup.show(damage, () => popupPool.release(popup));
```

### 4-3. 풀 크기 기준

| 풀 | 크기 |
|----|------|
| 데미지 팝업 | 20 |
| 지면 아이템 스프라이트 | 30 |
| 파티클 스프라이트 | 50 |
| 적 스프라이트 | 15 |

---

## 5. 맵 생성 최적화

### 5-1. 청크 단위 생성 (plan 21 보완)

맵 1개(100×100)를 **10×10 청크 10개**로 분할해 프레임 분산 생성:

```typescript
const CHUNK_SIZE = 10; // 10×10 타일 = 1 청크
const CHUNKS_PER_FRAME = 2; // 프레임당 2개 청크 처리

async function* generateMapChunked(seed: string, mapX: number, mapY: number) {
  const heightMap = generateHeightMap(seed, mapX, mapY); // 동기, 빠름
  for (let cy = 0; cy < 10; cy++) {
    for (let cx = 0; cx < 10; cx++) {
      yield processChunk(heightMap, cx, cy); // 청크 단위 결과
    }
  }
}

// GameScene에서 제너레이터 소비
async function loadMapProgressive(gen: AsyncGenerator): Promise<void> {
  let frame = 0;
  for await (const chunk of gen) {
    applyChunk(chunk);
    if (++frame % CHUNKS_PER_FRAME === 0) {
      await new Promise(r => requestAnimationFrame(r)); // 프레임 양보
    }
  }
}
```

### 5-2. 높이맵 캐시

같은 seed + mapX + mapY 조합은 항상 동일한 결과 → 메모리 캐시:

```typescript
const heightMapCache = new Map<string, number[][]>();

function getHeightMap(seed: string, mapX: number, mapY: number): number[][] {
  const key = `${seed}:${mapX},${mapY}`;
  if (!heightMapCache.has(key)) {
    heightMapCache.set(key, generateHeightMap(seed, mapX, mapY));
  }
  return heightMapCache.get(key)!;
}
// 캐시 크기 제한: 최대 9개 (3×3 그리드, 이후 LRU 방식으로 제거)
```

---

## 6. Firebase 쓰기 최소화

### 6-1. 위치 업로드 스로틀

plan 20에서 100ms 주기 업로드 — 실제로는 **이동 중일 때만** 업로드:

```typescript
// 이전 위치와 비교해 변화가 있을 때만 전송
const POSITION_THRESHOLD = 2; // px
let lastUploadedPos = { x: 0, y: 0 };

function maybeUploadPosition(x: number, y: number): void {
  const dx = Math.abs(x - lastUploadedPos.x);
  const dy = Math.abs(y - lastUploadedPos.y);
  if (dx < POSITION_THRESHOLD && dy < POSITION_THRESHOLD) return;
  lastUploadedPos = { x, y };
  multiplayerSystem.uploadPosition(x, y, mapX, mapY, facing);
}
```

### 6-2. 배치 업데이트 (Batch Write)

여러 필드 변경이 동시 발생 시 개별 write 대신 한 번에:

```typescript
// 나쁜 예: 3번 write
await set(ref(db, '.../hp'), hp);
await set(ref(db, '.../hunger'), hunger);
await set(ref(db, '.../fatigue'), fatigue);

// 좋은 예: 1번 write
await update(ref(db, `.../players/${myId}`), { hp, hunger, fatigue });
```

### 6-3. 상태 변화 임계값 필터

수치가 미세하게 변했을 때 Firebase 업로드 생략:

```typescript
const STAT_THRESHOLD = 2; // 2 이상 변화 시에만 업로드
let lastUploadedStats = { hp: 0, hunger: 0, fatigue: 0 };

function maybeUploadStats(hp: number, hunger: number, fatigue: number): void {
  if (
    Math.abs(hp - lastUploadedStats.hp) < STAT_THRESHOLD &&
    Math.abs(hunger - lastUploadedStats.hunger) < STAT_THRESHOLD &&
    Math.abs(fatigue - lastUploadedStats.fatigue) < STAT_THRESHOLD
  ) return;
  lastUploadedStats = { hp, hunger, fatigue };
  multiplayerSystem.uploadStats(hp, hunger, fatigue);
}
```

---

## 7. 메모리 관리

### 7-1. 맵 전환 시 완전 해제

```typescript
function unloadMap(): void {
  // 타일맵 완전 파괴
  currentTilemap?.destroy();
  currentTilemap = null;

  // 텍스처는 유지 (재사용) — 타일 스프라이트만 제거
  objectGroup.clear(true, true);
  buildingGroup.clear(true, true);
  enemyGroup.clear(true, true);
  groundItemGroup.clear(true, true);

  // 풀은 유지 (재사용)
}
```

### 7-2. 텍스처 재사용

맵 전환 시 타일 텍스처(`tile_dirt`, `tile_water` 등)는 **파괴하지 않음**:
- Phaser `TextureManager`에 등록된 텍스처는 씬 전환·맵 전환과 무관하게 유지
- `preload()`에서 1회만 생성, 이후 재사용

---

## 8. FPS 모니터링 (개발 모드)

```typescript
// import.meta.env.DEV === true 일 때만 표시
if (import.meta.env.DEV) {
  const fpsText = scene.add.text(8, 8, '', {
    fontSize: '12px', color: '#00ff00', fontFamily: 'monospace'
  }).setScrollFactor(0).setDepth(9999);

  scene.events.on('postupdate', () => {
    const fps   = Math.round(scene.game.loop.actualFps);
    const mem   = (performance as any).memory
                    ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
                    : '–';
    const objs  = scene.children.length;
    fpsText.setText(`FPS: ${fps}  MEM: ${mem}MB  OBJ: ${objs}`);
  });
}
```

설정 패널의 "FPS 표시" 토글(plan 19) → 프로덕션에서도 활성화 가능.

---

## 9. 렌더링 최적화 추가 설정

```typescript
// main.ts Phaser 설정 추가
const config: Phaser.Types.Core.GameConfig = {
  // ...기존 설정...
  render: {
    pixelArt: true,
    antialias: false,
    powerPreference: 'high-performance',   // GPU 힌트
    batchSize: 2048,                        // 드로우콜 배치 크기
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,   // requestAnimationFrame 사용
    smoothStep: true,
  },
};
```

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/SpritePool.ts` | 신규: 범용 오브젝트 풀 |
| `src/world/MapGenerator.ts` | 청크 분할 생성, 높이맵 캐시 |
| `src/scenes/GameScene.ts` | 타일 컬링 설정, 풀 초기화, FPS 표시 |
| `src/systems/MultiplayerSystem.ts` | 위치·스탯 임계값 필터, 배치 업데이트 |
| `src/main.ts` | Phaser 렌더링 최적화 옵션 추가 |
| `src/systems/DropSystem.ts` | 지면 아이템 스프라이트 풀 사용 |
| `src/ui/DamagePopup.ts` | 데미지 팝업 풀 사용 |

---

## 11. 확정 규칙

- 성능 최적화는 **측정 후 적용** 원칙 — FPS 모니터링으로 병목 확인 후 최적화
- 풀 소진 시 새 오브젝트 생성 대신 **조용히 생략** (데미지 팝업 등 시각 요소)
- 타일 텍스처는 게임 전체 생애 동안 1회만 생성·유지 (절대 파괴하지 않음)
- Firebase 임계값 필터는 **멀티플레이 전용** — 싱글플레이에서는 불필요
- 청크 분할 생성은 맵 캐시 미스(사전 생성 실패) 시에만 체감됨 — 사전 생성이 우선
- 메모리 300MB 초과 감지 시 콘솔 경고 출력 (강제 조치 없음)
