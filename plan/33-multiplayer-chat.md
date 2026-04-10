# 설계 33 — 멀티플레이 채팅 시스템

> **전제 조건**: 01~32 단계 완료 상태.
> MultiplayerSystem(plan 20), TitleScene, GameScene이 구현되어 있다고 가정한다.
> 싱글플레이 모드에서는 채팅 UI 미표시.

---

## 1. 이번 단계 목표

1. **채팅 입력 & 전송** — Enter 키로 입력창 열기, 메시지 전송
2. **채팅 렌더링** — 화면 좌하단 채팅 로그 + 말풍선
3. **Firebase 동기화** — 메시지 실시간 수신·표시
4. **시스템 메시지** — 입장·퇴장·사망 알림
5. **채팅 제한** — 도배 방지, 길이 제한

---

## 2. Firebase 채팅 데이터 구조

```
/rooms/{seed}/chat/
  {msgId}/
    ├── playerId: string
    ├── playerName: string
    ├── text: string
    ├── type: 'user' | 'system'
    ├── timestamp: number       // Date.now()
    └── color: string           // 플레이어 고유 색상 (hex)
```

메시지 보존 정책:
- 최근 **50개** 메시지만 유지 (신규 메시지 push 시 51개 이상이면 가장 오래된 것 삭제)
- Firebase `limitToLast(50)` 쿼리로 조회

---

## 3. 채팅 입력

### 3-1. Enter 키 흐름

```
Enter 키 입력
  → 채팅 입력창 활성화
    → 게임 키보드 입력 일시 차단 (방향키 이동 등)
    → 텍스트 입력 가능 상태

메시지 입력 후 Enter
  → 전송 처리
  → 입력창 닫힘 / 게임 조작 복귀

ESC 또는 빈 Enter
  → 입력 취소, 입력창 닫힘
```

### 3-2. 입력창 UI

```
┌──────────────────────────────────────┐
│ > _                           [전송] │
└──────────────────────────────────────┘
```

- 위치: 화면 좌하단 채팅 로그 바로 아래
- 폭: 280px, 높이: 28px
- 최대 입력 길이: **60자**
- 한글·영문·숫자·특수문자 모두 허용
- 입력창 활성 중: 배경 `rgba(0,0,0,0.85)`, 커서 깜빡임

### 3-3. 도배 방지

```typescript
const CHAT_COOLDOWN_MS = 2000;   // 2초 쿨다운
let lastSentAt = 0;

function trySendMessage(text: string): boolean {
  const now = Date.now();
  if (now - lastSentAt < CHAT_COOLDOWN_MS) {
    notifySystem.show('메시지를 너무 빠르게 보내고 있습니다', 'warning');
    return false;
  }
  lastSentAt = now;
  return true;
}
```

빈 메시지(공백만) 전송 차단:
```typescript
if (text.trim().length === 0) return;
```

---

## 4. 채팅 로그 UI

### 4-1. 위치 및 크기

```
화면 좌하단 (HUD 생존 수치 게이지 위)
폭: 280px
최대 표시 줄: 6줄
줄 높이: 18px
```

### 4-2. 로그 렌더링

```
┌────────────────────────────────┐
│ [생존자] 여기 나무 많네요       │
│ [탐험가] 조심해요 적 옵니다!   │
│ ★ 나무꾼님이 입장했습니다      │   ← 시스템 메시지 (회색 이탤릭)
│ [생존자] ㅇㅋ                  │
│                                │
│                                │
└────────────────────────────────┘
```

스타일:
- 배경: `rgba(0,0,0,0.45)` 반투명, 테두리 없음
- 플레이어 이름: 고유 색상 (아래 색상 풀 참조)
- 메시지 텍스트: 흰색 12px monospace
- 시스템 메시지: 회색 (#aaaaaa) 이탤릭
- 가장 오래된 메시지부터 위에 표시, 새 메시지는 아래 추가

### 4-3. 페이드 아웃

메시지 수신 후 **8초** 경과 시 서서히 페이드 아웃 (알파 1.0 → 0.0, 2초):
- 마우스 호버 시 페이드 일시 중단 (열람 가능)
- Enter 키로 채팅창 열리면 전체 로그 불투명하게 복원

### 4-4. 플레이어 고유 색상

플레이어 ID 해시 기반 색상 배정 (총 8색):

```typescript
const PLAYER_COLORS = [
  '#ff9966', '#66ccff', '#99ff99', '#ffcc66',
  '#cc99ff', '#ff6699', '#66ffcc', '#ffff66',
];

function getPlayerColor(playerId: string): string {
  let hash = 0;
  for (const ch of playerId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}
```

---

## 5. 말풍선 (Bubble)

캐릭터 스프라이트 위에 최근 메시지 말풍선 표시:

```
  ┌──────────────┐
  │ 적 조심해요! │
  └──────┬───────┘
         ▼
   [캐릭터 스프라이트]
```

```typescript
interface ChatBubble {
  playerId: string;
  text: string;
  timeLeft: number;   // ms, 4초 표시 후 사라짐
}

// 표시 규칙
// - 최대 24자 초과 시 잘라서 "..." 추가
// - 폰트: 10px monospace, 흰색
// - 배경: 둥근 사각형 rgba(0,0,0,0.7)
// - 깊이: 캐릭터 스프라이트 위 (depth +1)
```

---

## 6. 시스템 메시지

Firebase에서 `type: 'system'` 으로 구분:

| 이벤트 | 메시지 |
|--------|--------|
| 플레이어 입장 | "★ [이름]님이 입장했습니다" |
| 플레이어 퇴장 | "★ [이름]님이 퇴장했습니다" |
| 플레이어 사망 | "💀 [이름]님이 사망했습니다" |
| 광란 진입 | "⚡ [이름]님이 광란 상태에 돌입했습니다!" |

시스템 메시지 전송:
```typescript
// MultiplayerSystem에서 호출
function sendSystemMessage(text: string): void {
  push(ref(db, `rooms/${seed}/chat`), {
    playerId: 'system',
    playerName: 'system',
    text,
    type: 'system',
    timestamp: Date.now(),
    color: '#aaaaaa',
  });
}
```

---

## 7. ChatSystem 클래스

```typescript
export class ChatSystem {
  private messages: ChatMessage[] = [];
  private inputActive: boolean = false;
  private cooldownTimer: number = 0;

  // Firebase 리스너 등록 (joinRoom 시 호출)
  init(seed: string, db: Database): void

  // 메시지 전송
  send(text: string, player: LocalPlayer): void

  // Enter 키 처리
  onEnterKey(): void

  // 매 프레임: 말풍선 수명, 로그 페이드 타이머
  update(delta: number): void

  // 입력 상태 조회 (GameScene 키보드 차단용)
  isInputActive(): boolean

  // 메시지 수신 콜백 (Firebase onChildAdded)
  private onMessageReceived(msg: ChatMessage): void
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  type: 'user' | 'system';
  timestamp: number;
  color: string;
  alpha: number;        // 페이드 아웃용 로컬 상태
  fadeTimer: number;    // 8초 카운트다운
}
```

---

## 8. 싱글플레이 처리

```typescript
// GameScene 초기화 시
if (!multiplayerMode) {
  chatSystem.disable();   // 채팅 UI 완전 숨김
  // Enter 키는 다른 용도 없음 → 조용히 무시
}
```

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/ChatSystem.ts` | 신규: 채팅 전송·수신·말풍선 관리 |
| `src/ui/ChatLog.ts` | 신규: 채팅 로그 렌더링 (Phaser DOM 또는 Graphics) |
| `src/ui/ChatInput.ts` | 신규: Enter 키 입력창 HTML overlay |
| `src/ui/ChatBubble.ts` | 신규: 캐릭터 위 말풍선 |
| `src/scenes/GameScene.ts` | ChatSystem 통합, Enter 키 핸들러, 키보드 차단 |
| `src/systems/MultiplayerSystem.ts` | 입장·퇴장·사망 시스템 메시지 전송 |
| `src/systems/ActionSystem.ts` | 광란 진입 시스템 메시지 전송 |
| `database.rules.json` | `/chat` 쓰기 규칙 추가 |

### database.rules.json 채팅 규칙 추가

```json
{
  "rules": {
    "rooms": {
      "$seed": {
        "chat": {
          ".read": true,
          ".write": true,
          "$msgId": {
            ".validate": "newData.child('text').isString()
              && newData.child('text').val().length <= 60
              && newData.child('type').val() === 'user'
                ? newData.child('playerId').isString() : true"
          }
        }
      }
    }
  }
}
```

---

## 10. 확정 규칙

- 채팅은 멀티플레이 전용 — 싱글플레이에서 UI 완전 비표시
- 메시지 길이 60자 초과 입력 불가 (입력창에서 maxLength 제한)
- 2초 쿨다운 중 전송 시도 → 경고 메시지, 전송 차단
- 메시지는 서버에 50개까지 보존, 이전 기록은 입장 시 `limitToLast(50)` 으로 불러옴
- 채팅 입력 중 게임 키보드 이벤트(방향키, B, V, E, H, M, ESC) 모두 차단
- ESC로 입력 취소 시 게임 ESC 메뉴 열리지 않음 (입력창 닫기 우선)
- 말풍선은 같은 플레이어가 새 메시지 보내면 이전 것 즉시 교체
- 욕설 필터링 없음 — 초기 버전은 무필터, 추후 클라이언트 사이드 필터 추가 가능
