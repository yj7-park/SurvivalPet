# 설계 38 — 모바일 터치 지원

> **전제 조건**: 01~37 단계 완료 상태.
> plan 27(배포), plan 00(키보드 조작)을 기반으로 한다.
> 기존 키보드·마우스 동작은 그대로 유지하며 터치 입력을 추가 레이어로 얹는다.

---

## 1. 이번 단계 목표

1. **가상 조이스틱** — 이동 방향 입력 (좌 하단)
2. **액션 버튼** — 상호작용·공격·인벤토리 등 (우 하단)
3. **터치 타깃 확대** — 기존 클릭 UI 요소를 터치 친화적으로 조정
4. **반응형 레이아웃** — 화면 크기에 따른 HUD/UI 재배치
5. **터치 전용 제스처** — 핀치 줌, 탭 상호작용

---

## 2. 환경 감지

```typescript
export const isTouchDevice: boolean =
  'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Phaser 초기화 시
if (isTouchDevice) {
  touchInputSystem.enable();
  game.input.mouse.disableContextMenu();   // 꾹 누름 컨텍스트 방지
}
```

- 터치 기기에서만 가상 컨트롤러 표시 (데스크탑은 기존 UI 유지)
- `localStorage['sv_force_touch'] = '1'` 로 데스크탑에서 테스트 가능

---

## 3. 가상 조이스틱

### 3-1. 위치 및 외형

```
화면 좌 하단 (x: 80px, y: 화면높이 - 80px)

  ┌── 외부 원 (반경 56px, rgba(255,255,255,0.15)) ──┐
  │                                                  │
  │         ● 내부 핸들 (반경 24px, 흰색 0.4)       │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 3-2. 동작

```typescript
interface JoystickState {
  active: boolean;
  originX: number; originY: number;   // 터치 시작점
  handleX: number; handleY: number;   // 현재 핸들 위치
  dx: number; dy: number;             // 정규화 방향 (-1~1)
  magnitude: number;                  // 0~1
}

// touchstart: 조이스틱 외부 원 영역(반경 80px) 내 터치 → 활성화
// touchmove:  핸들 위치 = origin + clamp(delta, 0, 56px)
//             dx = deltaX / 56, dy = deltaY / 56
// touchend:   dx=0, dy=0, active=false → 캐릭터 정지

// 이동 속도 적용
const speed = characterStats.effectiveMoveSpeed * joystick.magnitude;
velocity.x = joystick.dx * speed;
velocity.y = joystick.dy * speed;
```

- 조이스틱은 터치 시작 위치에서 생성 (고정형 아님 — 자유 위치)
- 단, 화면 좌측 절반에서만 활성화 (우측은 액션 버튼 영역)

---

## 4. 액션 버튼 (우 하단)

### 4-1. 버튼 배치

```
화면 우 하단:

         [B]
    [E]  [⚔]  [I]
         [H]

좌표 (화면 기준):
  ⚔ (공격/상호작용): 우측 - 72px, 하단 - 80px
  I (인벤토리):       우측 - 148px, 하단 - 80px
  E (장비):           우측 - 72px,  하단 - 156px
  B (건설):           우측 - 148px, 하단 - 156px
  H (도움말):         우측 - 220px, 하단 - 80px
```

### 4-2. 버튼 스펙

| 버튼 | 키 대응 | 반경 | 아이콘 |
|------|---------|------|--------|
| ⚔ 상호작용/공격 | 스페이스바/클릭 | 36px | ⚔ |
| I 인벤토리 | I 키 | 28px | 🎒 |
| E 장비 | E 키 | 28px | 🛡 |
| B 건설 | B 키 | 28px | 🔨 |
| H 도움말 | H 키 | 28px | ? |

```
외형: 원형 버튼, rgba(0,0,0,0.55) 배경, 흰색 1px 테두리
눌림: rgba(255,255,255,0.2) 하이라이트 (0.1초)
```

### 4-3. 상호작용/공격 버튼 동작

터치 기기에서 상호작용 타깃 선택:
```
⚔ 버튼 탭
  → 캐릭터 주변 48px 이내 상호작용 가능 대상 탐색
  → 대상 1개: 즉시 상호작용
  → 대상 여러 개: 방향키 방향 기준 가장 가까운 것 선택
  → 대상 없음: 공격 동작 (전투 상태일 때)
```

---

## 5. 터치 기반 상호작용

### 5-1. 월드 탭 (화면 중앙 영역)

```
화면 중앙(조이스틱·버튼 영역 외) 탭
  → 현재 위치에서 탭 위치까지 자동 이동 (plan 11 A* 경로)
  → 이동 완료 후 대상 있으면 상호작용
  → (키보드 마우스 클릭과 동일한 동작)
```

### 5-2. UI 요소 탭

패널, 버튼, 인벤토리 슬롯 등 모든 클릭 영역:
- **최소 터치 타깃**: 44×44px (Apple HIG 기준)
- 기존 24px 이하 버튼은 터치 시 히트 영역 44px로 확장 (시각 크기 유지)

### 5-3. 핀치 줌

```typescript
// 두 손가락 핀치로 줌 인/아웃 (기존 마우스 스크롤 대체)
let lastPinchDist = 0;

scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
  if (scene.input.pointer1.isDown && scene.input.pointer2.isDown) {
    const dist = Phaser.Math.Distance.Between(
      scene.input.pointer1.x, scene.input.pointer1.y,
      scene.input.pointer2.x, scene.input.pointer2.y,
    );
    const delta = dist - lastPinchDist;
    cameraSystem.zoomBy(delta * 0.005);
    lastPinchDist = dist;
  }
});
```

줌 범위: 0.5× ~ 2.0× (기존 마우스 스크롤과 동일 범위)

---

## 6. 반응형 HUD 레이아웃

### 6-1. 화면 크기 분류

```typescript
enum ScreenSize { SMALL, MEDIUM, LARGE }

function getScreenSize(w: number): ScreenSize {
  if (w < 480)  return ScreenSize.SMALL;   // 스마트폰 세로
  if (w < 768)  return ScreenSize.MEDIUM;  // 스마트폰 가로 / 태블릿
  return ScreenSize.LARGE;                 // 데스크탑
}
```

### 6-2. 크기별 HUD 조정

| 요소 | SMALL (<480px) | MEDIUM | LARGE |
|------|---------------|--------|-------|
| 생존 게이지 | 상단 전체 폭 | 상단 좌측 | 상단 좌측 (기존) |
| 시계 | 상단 중앙 | 상단 우측 | 상단 우측 (기존) |
| 채팅 로그 | 숨김 (토글) | 좌하단 (작게) | 좌하단 (기존) |
| 미니맵 | M 버튼 탭 시만 | M 버튼 | M 키 |
| 토스트 알림 | 상단 중앙 | 우상단 | 우상단 (기존) |

### 6-3. 생존 게이지 (SMALL 모드)

```
┌──────────────────────────────────────────────────┐
│  ❤ ████████░░  🍖 ██████░░░░  😴 ████░░░░░░     │  ← 상단 전체 폭
└──────────────────────────────────────────────────┘
```

가로로 3개 게이지 배치, 각 아이콘 + 축약 바 형태.

---

## 7. 소프트 키보드 회피

채팅 입력창(plan 33) 활성 시 소프트 키보드가 올라와 화면을 가리는 문제 해결:

```typescript
// ChatInput.ts
chatInputElement.addEventListener('focus', () => {
  // iOS Safari: window.scrollTo(0, 0) 으로 뷰포트 고정
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.body.style.height = `${window.visualViewport?.height ?? window.innerHeight}px`;
  }, 300);
});

// visualViewport resize 이벤트로 키보드 높이 감지
window.visualViewport?.addEventListener('resize', () => {
  const keyboardH = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
  gameCanvas.style.marginBottom = `${keyboardH}px`;
});
```

---

## 8. 터치 전용 설정 옵션

ESC 메뉴 → 설정(plan 37)에 터치 섹션 추가:

```
터치 컨트롤:
  조이스틱 크기:   [소 / 중● / 대]
  버튼 투명도:     [────●────]  40%
  진동 피드백:     [ON]         (navigator.vibrate 지원 시)
```

진동 피드백:
```typescript
// 공격 명중, 피해 수신, 레벨업 등 주요 이벤트
if (isTouchDevice && navigator.vibrate) {
  navigator.vibrate(30);   // 30ms 짧은 진동
}
```

---

## 9. TouchInputSystem 클래스

```typescript
export class TouchInputSystem {
  private enabled: boolean = false;
  private joystick: VirtualJoystick;
  private actionButtons: Map<string, ActionButton>;
  private screenSize: ScreenSize;

  enable(): void
  disable(): void

  // 매 프레임: 조이스틱 상태 → 이동 벡터 반환
  getMovementVector(): { x: number; y: number }

  // 버튼 눌림 상태
  isButtonDown(key: 'interact' | 'inventory' | 'equipment' | 'build' | 'help'): boolean

  // 화면 크기 변경 대응 (window resize 이벤트)
  onResize(width: number, height: number): void

  update(delta: number): void
  render(): void   // 조이스틱 + 버튼 오버레이 렌더
}
```

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/TouchInputSystem.ts` | 신규: 가상 조이스틱 + 액션 버튼 |
| `src/ui/VirtualJoystick.ts` | 신규: 조이스틱 렌더링·입력 처리 |
| `src/ui/ActionButtonBar.ts` | 신규: 우하단 액션 버튼 오버레이 |
| `src/scenes/GameScene.ts` | TouchInputSystem 통합, 이동 벡터 통합 처리 |
| `src/ui/HUD.ts` | 반응형 레이아웃 (ScreenSize 분기) |
| `src/ui/ChatInput.ts` | 소프트 키보드 회피 로직 추가 |
| `src/ui/ESCMenu.ts` | 터치 설정 섹션 추가 (plan 37 확장) |
| `src/systems/SoundSystem.ts` | 진동 피드백 연동 |
| `vite.config.ts` | PWA manifest 추가 (홈 화면 추가 지원) |

### vite.config.ts PWA 설정

```typescript
// vite.config.ts 추가
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Basecamp',
    short_name: 'Basecamp',
    display: 'fullscreen',         // 주소창 숨김
    orientation: 'landscape',     // 가로 모드 강제
    theme_color: '#1a1a2e',
    background_color: '#000000',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
})
```

---

## 11. 확정 규칙

- 터치 컨트롤은 기존 키보드·마우스와 **동시 작동** (혼용 가능)
- 조이스틱은 고정 위치 아님 — 화면 좌측 절반 어디든 터치 시작 시 그 위치에 생성
- 데스크탑 브라우저에서는 가상 컨트롤러 미표시 (isTouchDevice 기준)
- 터치 히트 영역 최소 44×44px (iOS HIG) — 시각 크기는 더 작아도 됨
- 가로 모드 강제 권장 (세로 모드도 지원하되 SMALL 레이아웃으로 동작)
- PWA 홈 화면 추가 시 `display: fullscreen` 으로 주소창 제거
- 진동 피드백은 `navigator.vibrate` 미지원 기기에서 조용히 무시
