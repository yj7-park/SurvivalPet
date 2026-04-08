# 설계 12 — 건축 시스템 고도화

> **전제 조건**: 11 단계 완료 상태.
> 건설 패널(B키), BuildSystem, 명령 큐가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. 건축 도중 이석(離席) 시 **중단 상태 보존** → 나중에 이어서 건축 가능
2. 건축물 **철거** 기능 (시간 소요, 자원 50% 반환)
3. 큐에 예약된 건축을 **ghost 이미지**로 표시하고 순서대로 **연결선** 렌더링
4. 건축 속도에 **STR 능력치** 반영 (이미 buildTime()에 있지만 UI 안내 추가)

---

## 2. 건축 중단 / 재개

### 2-1. 현재 동작 (변경 전)

플레이어가 건축 범위(`BUILD_RANGE = 48px`)를 벗어나면 → **건축 취소** + 자원 소모됨

### 2-2. 변경 후 동작

| 상황 | 처리 |
|------|------|
| 플레이어가 범위 이탈 | 진행률(%) 저장 → **중단 상태**로 유지 |
| 중단 중 건축물 표시 | 반투명 ghost 스프라이트 + 오렌지 틴트, 알파 = 0.3 + 진행률×0.4 |
| 플레이어가 범위 내 재진입 클릭 | 저장된 진행률부터 **이어서** 건축 재개 |
| ESC 또는 명시적 취소 | 중단 상태 삭제, **자원 환불 없음** (비용은 시작 시 이미 차감) |

### 2-3. 중단 상태 데이터 구조

```typescript
interface PartialBuild {
  id: string;           // tileKey
  defName: string;
  material: 'wood' | 'stone';
  tileX: number;
  tileY: number;
  progressMs: number;   // 이미 진행된 시간(ms)
  totalMs: number;      // 완료에 필요한 전체 시간(ms)
  ghost: Sprite;        // 반투명 스프라이트
}
```

### 2-4. 클릭 시 우선순위

```
1. 해당 타일에 PartialBuild 있음 → startBuild() → 재개 (비용 차감 없음)
2. 해당 타일에 PlacedStructure 있음 → 상호작용 메뉴 (우클릭 철거 등)
3. 타일이 비어있음 → 새 건축 시작
```

---

## 3. 건축 철거

### 3-1. 철거 발동 조건

- **우클릭** → 완공 구조물 위에 컨텍스트 팝업 표시
- 팝업 항목: `[🔨 재개]` (중단 건물) / `[💥 철거]` (완공 건물)

### 3-2. 철거 흐름

```
우클릭 완공 구조물
  → 컨텍스트 팝업 표시
    → "철거" 선택
      → 범위 내면 철거 시작
      → 범위 밖이면 자동이동 후 철거 시작
        → 진행 바 표시 (빨간색)
          → 완료: 구조물 제거 + 자원 50% 반환
```

### 3-3. 철거 시간

```
철거 소요 시간 = buildTime(baseTimeSec) × 재료배수 × 0.6
  (건축의 60%)
```

예시:
| 구조물 | 목재 건축 | 목재 철거 |
|--------|----------|----------|
| 벽 | 3초 기준 | 1.8초 기준 |
| 침대 | 5초 기준 | 3초 기준 |
| 작업대 | 6초 기준 | 3.6초 기준 |

### 3-4. 자원 반환 규칙

| 내구도 상태 | 반환 비율 |
|------------|----------|
| 내구도 > 75% | 비용의 **75%** 반환 |
| 내구도 50–75% | 비용의 **50%** 반환 |
| 내구도 < 50% | 비용의 **25%** 반환 |

소수점은 올림(ceil). 목재 5개 비용 → 50% = 목재 3개 반환.

### 3-5. 컨텍스트 팝업 UI

```
우클릭 → 클릭 위치 근처에 팝업:

  ┌──────────────┐
  │ 🔨 재개      │  ← PartialBuild일 때만 표시
  │ 💥 철거      │
  │ ❌ 취소      │
  └──────────────┘

팝업 닫힘 조건: 항목 선택 / ESC / 다른 곳 클릭
```

### 3-6. 철거 진행 바

- 색상: `#ff4400` (빨간–오렌지)
- 위치: 구조물 위 타일 기준 (기존 건설 진행 바와 동일 위치)
- 플레이어가 범위 이탈 시 → **철거 취소** (진행 저장 없음, 자원 미반환)

---

## 4. 건축 큐 시각화

큐에 등록된 건설 명령을 필드에 시각적으로 표시.

### 4-1. Ghost 스프라이트

큐에 `build` 명령이 추가될 때마다:

| 항목 | 값 |
|------|----|
| 텍스처 | `struct_{defName}_{material}` |
| 알파 | `0.25` |
| 틴트 | `0x88aaff` (연한 파란색) |
| 깊이(depth) | `1` |
| 위치 | 예약된 타일 중심 |

### 4-2. 연결선

큐에 건설 명령이 2개 이상일 때, 현재 위치 → 1번 → 2번 → … 순서로 연결선 렌더링.

```
현재 위치 ──→ [1번 ghost] ──→ [2번 ghost] ──→ [3번 ghost]

선 스타일:
  - 색상: #88aaff
  - 알파: 0.6
  - 두께: 1.5px
  - Phaser Graphics 오브젝트로 매 프레임 재렌더링
```

### 4-3. 업데이트 타이밍

- 큐 변경(추가/제거/실행) 때마다 ghost + 선 갱신
- 명령이 실행되면 해당 ghost 제거, 나머지 번호 한 칸씩 당김

### 4-4. Shift + 건설 클릭 UI 흐름

```
Shift 누른 상태에서 건설 위치 클릭
  → 재료 보유 여부 체크 (미보유 시 툴팁 "재료 부족")
  → 큐에 build 명령 추가
  → ghost 스프라이트 즉시 생성
  → 연결선 갱신
```

> 주의: 큐에 추가 시 재료를 즉시 차감하지 않음.  
> 실제 차감은 build 명령 실행 시점에.

---

## 5. 건축 속도 UI 안내

건설 패널에 능력치 반영 정보 표시:

```
[벽 (목재)] 
재료: 목재 ×5
소요: 3.0s  ← STR에 따라 달라짐 (실제 계산값 표시)
```

- 건설 패널 각 아이템 버튼에 마우스 오버 시 tooltip으로 예상 시간 표시
- 계산식: `max(1000, baseSec * 1000 - (STR - 5) * 300)` ms

---

## 6. 구현 구조

### BuildSystem 변경 사항

```typescript
// 추가 인터페이스
interface PartialBuild { ... }

// 추가 Map
private partialBuilds: Map<string, PartialBuild>
private pendingBuilds: PendingBuild[]  // 큐 ghost용
private queueLines: Phaser.GameObjects.Graphics

// 변경 메서드
startBuild()   // PartialBuild 있으면 재개
pauseBuild()   // 이탈 시 PartialBuild 저장
cancelBuild()  // ESC 등 명시적 취소 (PartialBuild 제거)

// 신규 메서드
startDemolish(tx, ty, stats, inventory): boolean
cancelDemolish(): void
addPendingBuild(defName, material, tileX, tileY): string  // → id 반환
removePendingBuild(id): void
redrawQueueLines(): void
```

### GameScene 변경 사항

| 위치 | 변경 내용 |
|------|-----------|
| `pointerdown` 이동키 | `cancelBuild()` → `pauseBuild()` |
| `pointerdown` 우클릭 | 구조물/PartialBuild 위이면 컨텍스트 팝업 표시 |
| `pointerdown` 좌클릭 | PartialBuild 타일 클릭 → 재개 |
| `processNextQueueCommand 'build'` | `addPendingBuild()` 호출 후 ghost 등록 |
| 명령 완료/실패 | `removePendingBuild(id)` 호출 |

---

## 7. 확정 규칙

- 철거 중 피격 → 철거 취소 (자원 미반환)
- 한 번에 건설/철거 중 하나만 진행 가능
- PartialBuild는 맵 이동 시 초기화 (현재 맵에서만 유효)
- 큐 ghost는 맵 이동 시 전부 제거
