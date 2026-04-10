# 설계 37 — 알림 시스템 & ESC 일시정지 메뉴

> **전제 조건**: 01~36 단계 완료 상태.
> 이전 설계(plan 32, 33, 36 등)에서 `notifySystem.show()` 를 참조했으나
> 공식 설계가 없었음. 이번 단계에서 확정한다.

---

## 1. 이번 단계 목표

1. **알림(Toast) 시스템** — 게임 이벤트를 화면에 간단히 표시
2. **ESC 일시정지 메뉴** — 설정·저장·타이틀 복귀
3. **이벤트 로그 패널** — 최근 알림 기록 열람

---

## 2. 알림 시스템 (NotifySystem)

### 2-1. 알림 종류

```typescript
export type NotifyType =
  | 'info'      // 흰색 (일반 정보)
  | 'warning'   // 노랑 (주의)
  | 'danger'    // 빨강 (위험)
  | 'success'   // 초록 (성공)
  | 'loot';     // 하늘색 (아이템 획득)
```

### 2-2. 토스트 UI 레이아웃

```
화면 우측 상단 (x: 우측정렬, y: 60px부터 아래로 쌓임)

  ┌─────────────────────────────┐
  │ ⚠ 횃불이 곧 꺼집니다!       │  ← warning (노랑)
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │ ✅ 생선 스튜 완성            │  ← success (초록)
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │ 🎒 구운 고기 ×2 획득         │  ← loot (하늘색)
  └─────────────────────────────┘
```

### 2-3. 토스트 스펙

| 항목 | 값 |
|------|----|
| 너비 | 220px |
| 높이 | 28px (텍스트 1줄) |
| 폰트 | 11px monospace |
| 배경 | 반투명 `rgba(0,0,0,0.80)` + 왼쪽 4px 색상 바 |
| 표시 시간 | `info` 3초, `warning`/`danger` 4초, `success`/`loot` 2.5초 |
| 최대 동시 표시 | 5개 (초과 시 가장 오래된 것 제거) |
| 등장 | 오른쪽에서 슬라이드인 (0.2초) |
| 퇴장 | 페이드아웃 (0.4초) |

```typescript
interface ToastNotification {
  id: string;
  message: string;
  type: NotifyType;
  icon: string;       // 이모지 아이콘
  timeLeft: number;   // ms
  alpha: number;      // 페이드 아웃용
  slideX: number;     // 슬라이드인 진행
}
```

### 2-4. NotifySystem API

```typescript
export class NotifySystem {
  // 토스트 표시 (전 게임에서 호출)
  show(message: string, type: NotifyType = 'info'): void

  // 중복 방지: 동일 message가 이미 표시 중이면 갱신만
  showOnce(message: string, type: NotifyType): void

  // 매 프레임
  update(delta: number): void

  // 이벤트 로그에 추가 (화면에 표시 + 로그 기록)
  log(message: string, type: NotifyType): void
}
```

### 2-5. 타입별 아이콘 & 색상

| 타입 | 아이콘 | 왼쪽 바 색상 | 텍스트 색상 |
|------|--------|------------|-----------|
| info | ℹ | `#5599ff` | 흰색 |
| warning | ⚠ | `#ffcc00` | 노랑 |
| danger | ❗ | `#ff4444` | 빨강 |
| success | ✅ | `#44cc66` | 초록 |
| loot | 🎒 | `#44ccff` | 하늘색 |

### 2-6. 이전 설계에서 참조된 알림 목록

| 발생 지점 | 메시지 | 타입 |
|----------|--------|------|
| 횃불 소진 (plan 32) | "횃불이 꺼졌습니다" | warning |
| 횃불 30초 전 (plan 32) | "횃불이 곧 꺼집니다!" | warning |
| 채팅 쿨다운 (plan 33) | "메시지를 너무 빠르게 보내고 있습니다" | warning |
| 빗물 소화 (plan 36) | "빗물에 모닥불이 꺼졌습니다" | warning |
| 따뜻함 (plan 36) | "🔥 따뜻합니다" | info |
| 허기 경고 (plan 34) | "허기가 낮습니다" | danger |
| 피로 경고 (plan 34) | "피로가 낮습니다" | warning |
| 아이템 획득 (plan 16) | "[아이템명] ×N 획득" | loot |
| 레벨업 (plan 14) | "[숙련도] Lv.N 달성!" | success |
| 건설 완료 (plan 02) | "[건설물] 건설 완료" | success |
| 요리 완료 (plan 13) | "[음식] 완성" | success |
| 광란 진입 (plan 18) | "⚡ 광란 상태 돌입!" | danger |
| 사망 직전 HP (plan 25) | "위험: HP가 극도로 낮습니다" | danger |
| 겨울 첫 진입 (plan 35) | "❄ 겨울이 왔습니다..." | info |

---

## 3. ESC 일시정지 메뉴

### 3-1. 진입 방법

```
ESC 키 → 일시정지 메뉴 열기
  - 채팅 입력 중 ESC: 입력창 닫힘 우선 (plan 33 확정 규칙)
  - 건설 배치 중 ESC: 배치 취소 우선
  - 그 외 상태: 일시정지 메뉴 열기
```

### 3-2. 메뉴 구조

```
┌─────────────────────────────────────┐
│                                     │
│        ⛺ BASECAMP                  │
│                                     │
│   ┌───────────────────────────┐     │
│   │      계속하기              │     │
│   ├───────────────────────────┤     │
│   │      지금 저장             │     │
│   ├───────────────────────────┤     │
│   │      설정                 │     │
│   ├───────────────────────────┤     │
│   │      타이틀로 돌아가기     │     │
│   └───────────────────────────┘     │
│                                     │
│   슬롯 1  봄 3일 14:22             │
└─────────────────────────────────────┘
```

배경: 전체 화면 블러(`rgba(0,0,0,0.6)`) + 중앙 패널 460×320px

### 3-3. 버튼 동작

| 버튼 | 동작 |
|------|------|
| 계속하기 | 메뉴 닫기, 게임 재개 (ESC 재입력과 동일) |
| 지금 저장 | `SaveSystem.saveNow()` 호출 → "저장 완료" 토스트 |
| 설정 | 설정 서브메뉴 열기 (4절 참조) |
| 타이틀로 돌아가기 | 확인 다이얼로그 → 확인 시 TitleScene 이동 |

### 3-4. 일시정지 처리

```typescript
// 메뉴 열림 동안:
// - GameScene 업데이트 루프 일시정지 (this.scene.pause())
// - 멀티플레이어 Firebase 리스너는 유지 (disconnect 방지)
// - BGM은 계속 재생 (볼륨 -50%)

scene.pause();
soundSystem.setBGMVolume(soundSystem.bgmVolume * 0.5);

// 메뉴 닫힘:
scene.resume();
soundSystem.setBGMVolume(original);
```

---

## 4. 설정 서브메뉴

```
┌─────────────────────────────────────┐
│  ← 뒤로                   설정      │
├─────────────────────────────────────┤
│  🔊 마스터 볼륨   [────●────]  70%  │
│  🎵 BGM 볼륨     [──●──────]  40%  │
│  🔔 효과음 볼륨  [──────●──]  80%  │
├─────────────────────────────────────┤
│  언어:  [한국어 ▼]                  │
├─────────────────────────────────────┤
│  FPS 표시:  [ON]                    │
│  좌표 표시:  [OFF]                  │
└─────────────────────────────────────┘
```

설정값은 `localStorage['sv_settings']` 에 저장:
```typescript
interface GameSettings {
  masterVolume: number;   // 0~1
  bgmVolume:    number;
  sfxVolume:    number;
  showFPS:      boolean;
  showCoords:   boolean;
  language:     'ko' | 'en';
}
const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7, bgmVolume: 0.4, sfxVolume: 0.8,
  showFPS: false, showCoords: false, language: 'ko',
};
```

볼륨 슬라이더 조작 즉시 `SoundSystem` 에 적용 (plan 26 연동).

---

## 5. 이벤트 로그 패널

### 5-1. 열기 방법

`L` 키 토글 (채팅 없을 때만):

```
┌────────────────────────────────────┐
│  📋 이벤트 로그               [✕]  │
├────────────────────────────────────┤
│ 14:22  ✅ 생선 스튜 완성           │
│ 14:18  ⚠ 횃불이 꺼졌습니다        │
│ 14:15  🎒 구운 고기 ×2 획득        │
│ 13:55  ❗ 광란 상태 돌입!          │
│ 13:50  ✅ woodcutting Lv.3 달성!  │
│ ...                                │
│                          (최대50줄) │
└────────────────────────────────────┘
```

- 화면 중앙 우측, 280×360px
- 최근 50개 로그 보관 (게임 세션 중만 유지, 저장 안 함)
- 게임 시간 표시 (HH:MM 형식)

---

## 6. NotifySystem 클래스

```typescript
export class NotifySystem {
  private toasts:    ToastNotification[];
  private logEntries: LogEntry[];
  private logPanel:  LogPanel | null;

  show(message: string, type: NotifyType): void
  showOnce(message: string, type: NotifyType): void
  log(message: string, type: NotifyType): void

  update(delta: number): void
  render(): void   // Phaser Graphics 기반 렌더링

  openLog(): void
  closeLog(): void
  toggleLog(): void
}

interface LogEntry {
  gameTime: string;   // "14:22"
  message: string;
  type: NotifyType;
}
```

---

## 7. ESCMenuSystem 클래스

```typescript
export class ESCMenuSystem {
  private isOpen: boolean = false;
  private subMenu: 'main' | 'settings' | null = null;

  // ESC 키 처리 (우선순위 체계 포함)
  handleEscKey(
    isChatActive: boolean,
    isBuildPlacing: boolean,
  ): void

  open(): void
  close(): void

  private onSave(): void
  private onSettings(): void
  private onReturnTitle(): void
}
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/NotifySystem.ts` | 신규: 토스트·로그 시스템 |
| `src/ui/ToastRenderer.ts` | 신규: 토스트 렌더링 (Phaser Graphics) |
| `src/ui/LogPanel.ts` | 신규: 이벤트 로그 패널 |
| `src/ui/ESCMenu.ts` | 신규: 일시정지 메뉴 + 설정 서브메뉴 |
| `src/systems/ESCMenuSystem.ts` | 신규: ESC 키 우선순위 처리 |
| `src/scenes/GameScene.ts` | NotifySystem·ESCMenuSystem 통합, L/ESC 키 핸들러 |
| `src/systems/SoundSystem.ts` | `setBGMVolume()` 일시정지 연동 |
| `src/systems/SaveSystem.ts` | `sv_settings` 로드·저장 |

---

## 9. 확정 규칙

- ESC 우선순위: 채팅 입력 닫기 > 건설 배치 취소 > 일시정지 메뉴
- 싱글플레이에서도 동일하게 동작 (Firebase 연결 없이)
- 일시정지 중 멀티플레이어 리스너 유지 → 재개 시 상태 갱신
- 설정은 슬롯과 무관하게 전역 저장 (`sv_settings`)
- 이벤트 로그는 세션 내 메모리 보관 — 저장/복원 없음
- 토스트 최대 5개 초과 시 가장 오래된 것 즉시 제거 (스택 밀리지 않음)
- `showOnce`: 동일 message 문자열 기준으로 중복 판별 (현재 화면에 있는 것만)
