# 설계 20 — Firebase 실시간 멀티플레이어

> **전제 조건**: 01~19 단계 완료 상태.
> TitleScene, GameScene, CharacterStats, SaveSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **Firebase Realtime Database 연동** — 플레이어 상태 실시간 동기화
2. **방(Room) 시스템** — Seed = 방 ID, 입장/퇴장 관리
3. **다른 플레이어 렌더링** — 원격 플레이어 위치·외형·상태 표시
4. **동기화 범위 확정** — 무엇을 서버에 올리고 무엇은 로컬 전용인지 명확화
5. **멀티플레이 전용 UI** — 플레이어 목록, 접속자 수 표시

---

## 2. Firebase 데이터 구조

```
/rooms/{seed}/
  players/{playerId}/
    ├── name: string
    ├── skin: number           // 외형 번호 0~2
    ├── x: number              // 월드 픽셀 좌표
    ├── y: number
    ├── mapX: number           // 현재 맵 좌표
    ├── mapY: number
    ├── hp: number
    ├── hunger: number
    ├── fatigue: number
    ├── action: number
    ├── facing: 'up'|'down'|'left'|'right'
    ├── isMoving: boolean
    ├── weapon: string | null  // 장착 무기 ID (스프라이트 표시용)
    ├── frenzy: boolean        // 광란 상태
    ├── online: boolean        // 접속 여부
    └── lastSeen: number       // Date.now()

  world/
    ├── buildings/{buildingId}/   // 건설물 (플레이어 공유)
    │     ├── type, mapX, mapY, tileX, tileY
    │     ├── durability, material
    │     └── builtBy: string    // playerId
    ├── minedRocks/{rockId}/      // 채굴된 암반
    └── cutTrees/{treeId}/        // 벌목된 나무 (regrowAt 포함)
```

### 2-1. 동기화 범위

| 데이터 | 동기화 방식 | 이유 |
|--------|-----------|------|
| 플레이어 위치·방향·이동 | 실시간 (100ms 주기) | 부드러운 움직임 표시 |
| HP·허기·피로·행동 수치 | 변경 시 전송 | 빈번하지 않음 |
| 광란 상태 | 변경 시 전송 | 다른 플레이어에게 위험 표시 |
| 인벤토리·장비 내용물 | **동기화 안 함** | 개인 데이터, 보안 |
| 숙련도·연구 해금 | **동기화 안 함** | 개인 데이터 |
| 건설물 추가/철거 | 즉시 전송 | 모든 플레이어 공유 지형 |
| 벌목 나무 | 즉시 전송 | 공유 자원 |
| 채굴 암반 | 즉시 전송 | 공유 자원 |
| 지면 드랍 아이템 | **동기화 안 함** | 클라이언트 전용 (단순화) |
| 행동 수치 | 로컬 전용 | 서버 부하 절감 |

---

## 3. MultiplayerSystem 클래스

```typescript
export class MultiplayerSystem {
  private db: Database;                        // Firebase Database 인스턴스
  private roomRef: DatabaseReference;          // /rooms/{seed}
  private playersRef: DatabaseReference;       // /rooms/{seed}/players
  private myId: string;                        // Firebase push key
  private remotePlayers: Map<string, RemotePlayerState>;

  // 연결
  async joinRoom(seed: string, character: CharacterInitData): Promise<void>
  async leaveRoom(): Promise<void>

  // 로컬 상태 업로드
  uploadPosition(x: number, y: number, mapX: number, mapY: number, facing: Direction): void
  uploadStats(hp: number, hunger: number, fatigue: number): void
  uploadFrenzy(active: boolean): void

  // 월드 이벤트 업로드
  uploadBuildingAdded(building: BuildingSaveEntry): void
  uploadBuildingRemoved(buildingId: string): void
  uploadTreeCut(entry: CutTreeEntry): void
  uploadRockMined(entry: MinedRockEntry): void

  // 원격 플레이어 조회
  getRemotePlayers(): RemotePlayerState[]

  // 월드 스냅샷 수신 (최초 입장 시)
  async fetchWorldSnapshot(): Promise<WorldSaveData>

  // 내부: Firebase 리스너 등록
  private listenPlayers(): void
  private listenWorld(): void
}

export interface RemotePlayerState {
  id: string;
  name: string;
  skin: number;
  x: number; y: number;
  mapX: number; mapY: number;
  hp: number; hunger: number; fatigue: number;
  facing: Direction;
  isMoving: boolean;
  weapon: string | null;
  frenzy: boolean;
  // 보간용 로컬 계산값
  renderX: number; renderY: number;
}
```

---

## 4. 위치 보간 (Interpolation)

네트워크 지연(50~200ms)으로 인한 끊김 방지:

```typescript
// 매 프레임 원격 플레이어 위치 보간
function interpolateRemote(remote: RemotePlayerState, delta: number): void {
  const LERP_FACTOR = 1 - Math.pow(0.01, delta / 1000); // delta ms 기준
  remote.renderX += (remote.x - remote.renderX) * LERP_FACTOR;
  remote.renderY += (remote.y - remote.renderY) * LERP_FACTOR;
}
// 실제 좌표(x,y)는 서버 수신값, 렌더링은 renderX/renderY 사용
```

위치 업로드 주기: **100ms** (throttle)
- 이동 중: 100ms마다 업로드
- 정지 상태: 2초마다 heartbeat 업로드 (온라인 여부 갱신)

---

## 5. 방 입장 흐름

```
타이틀 → Seed 입력 → [멀티플레이로 참가] 버튼
  → MultiplayerSystem.joinRoom(seed, character)
    1. Firebase /rooms/{seed}/players 에 내 정보 push
    2. onDisconnect() 등록 — 강제 종료 시 online:false 처리
    3. /rooms/{seed}/world 스냅샷 fetch → 맵에 건설물/채굴 반영
    4. players 리스너 등록 → 원격 플레이어 실시간 수신
    5. world 리스너 등록 → 건설물 변경 실시간 수신
  → LoadingScene → GameScene (멀티 모드)
```

방 참가 시 Seed 입력란 아래 현재 접속자 수 미리보기:
```
현재 이 Seed의 접속자: 3명
```
(Firebase 읽기 1회로 확인)

---

## 6. 원격 플레이어 렌더링

### 6-1. 스프라이트

- 로컬 플레이어와 동일한 스프라이트 (skin 번호 기반 팔레트)
- depth: 로컬 플레이어와 동일 레이어 (`y` 좌표 기반 depth 정렬)

### 6-2. 이름표

```
캐릭터 스프라이트 위 +6px:
  [플레이어 이름]   (10px, 흰색, 검정 그림자)
  ❤ 80  🍖 60      (상태 수치 간략 표시, 8px)
```

광란 상태인 원격 플레이어:
- 이름표 배경 빨간색
- 스프라이트 위 빨간 오라 효과 (plan 18과 동일)
- 마우스 호버 툴팁: "⚡ [이름] 광란 상태 — 위험!"

### 6-3. 같은 맵에 있는 플레이어만 렌더링

```typescript
// mapX, mapY가 일치하는 원격 플레이어만 렌더링
const visible = remotePlayers.filter(
  p => p.mapX === localPlayer.mapX && p.mapY === localPlayer.mapY
);
```

---

## 7. 공유 월드 이벤트 처리

### 7-1. 건설물

- 로컬에서 건설 완료 → `uploadBuildingAdded()` → Firebase
- 원격에서 건설 이벤트 수신 → `BuildSystem.addRemote(entry)` → 즉시 타일 업데이트
- 철거도 동일 (`uploadBuildingRemoved()`)

충돌 처리: 두 플레이어가 동시에 같은 타일에 건설 시도
- Firebase `transaction()` 사용: 먼저 쓴 쪽이 우선
- 늦은 쪽은 "이미 다른 플레이어가 건설했습니다" 알림 + 재료 반환

### 7-2. 나무·암반

- 벌목/채굴 완료 → Firebase에 해당 타일 기록 → 다른 클라이언트가 수신해 타일 제거
- 이미 없는 타일을 클릭 시 "이미 채취된 자원입니다" 알림

---

## 8. 접속 해제 처리

```typescript
// 방 참가 시 onDisconnect 등록
const presenceRef = ref(db, `rooms/${seed}/players/${myId}/online`);
onDisconnect(presenceRef).set(false);

// 정상 퇴장 시
await set(presenceRef, false);
await remove(ref(db, `rooms/${seed}/players/${myId}`));
```

오래된 플레이어 정리:
- `online: false` + `lastSeen` 이 10분 이상 지난 항목은 클라이언트 측에서 렌더링 제외
- 실제 데이터 삭제는 하지 않음 (Firebase Rules로 추후 관리)

---

## 9. Firebase 보안 Rules (초안)

```json
{
  "rules": {
    "rooms": {
      "$seed": {
        "players": {
          "$playerId": {
            ".read": true,
            ".write": "auth == null || $playerId === auth.uid"
          }
        },
        "world": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
```

> 인증 없이 익명으로 참가 가능 (Firebase Anonymous Auth 추후 도입 예정).
> 현재는 `.write: true` 로 단순화, 악의적 쓰기 방어는 추후 단계에서 강화.

---

## 10. 타이틀 화면 멀티플레이 진입

plan 19 Seed 입력 화면에 버튼 추가:

```
┌──────────────────────────────────────────┐
│  새 게임                           [✕]   │
├──────────────────────────────────────────┤
│  월드 Seed                               │
│  ┌──────────────────────┐  [🎲 랜덤]    │
│  │  abc123              │               │
│  └──────────────────────┘               │
│  현재 접속자: 3명                         │
│                                          │
│  [혼자 플레이 →]   [멀티플레이로 참가 →]  │
└──────────────────────────────────────────┘
```

- **혼자 플레이**: Firebase 연결 없이 로컬 단독 플레이 (plan 17~19 그대로)
- **멀티플레이로 참가**: MultiplayerSystem.joinRoom() 호출 후 GameScene

---

## 11. 멀티플레이 전용 UI

### 11-1. 접속자 목록 (Tab 키)

```
┌────────────────────────────┐
│  접속자 (3명)               │
├────────────────────────────┤
│  👤 생존자    ❤80  🍖60    │
│  👤 탐험가    ❤45  🍖30  ⚡│  ← 광란
│  👤 나무꾼    ❤100 🍖90    │
└────────────────────────────┘
```

- Tab 키로 표시/숨김
- 같은 방 전체 플레이어 표시 (다른 맵에 있어도 포함)
- 내 캐릭터는 이름 앞에 ★ 표시

### 11-2. 화면 상단 접속자 수

```
🌐 3명 접속 중   (우상단, 12px, 반투명)
```

---

## 12. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/MultiplayerSystem.ts` | 신규: Firebase 연결·동기화 전체 |
| `src/scenes/TitleScene.ts` | 멀티플레이 참가 버튼, 접속자 수 표시 |
| `src/scenes/GameScene.ts` | MultiplayerSystem 인스턴스, 원격 플레이어 렌더링 |
| `src/ui/PlayerListPanel.ts` | 신규: Tab 키 접속자 목록 |
| `src/systems/BuildSystem.ts` | `addRemote()`, `removeRemote()` 메서드 추가 |
| `src/systems/SaveSystem.ts` | 멀티 모드에서 저장/불러오기 비활성 처리 |
| `firebase.json` / `database.rules.json` | 신규: Firebase 보안 Rules |

---

## 13. 확정 규칙

- 멀티플레이는 **같은 Seed = 같은 방** (별도 방 코드 없음)
- 최대 동시 접속: Firebase 무료 플랜 기준 **100명** (맵 1개 방 기준)
- 플레이어 간 직접 거래·채팅은 이번 단계 미포함 (추후 설계)
- 멀티 중 로컬 저장 비활성 — 재접속 시 항상 Firebase 월드 스냅샷으로 복원
- PvP(플레이어 간 전투)는 광란 모드에서만 허용 (일반 공격으로 다른 플레이어 타겟 불가)
- 멀티 중 ESC 메뉴의 [저장하기] 버튼 숨김, [타이틀로] 만 표시
