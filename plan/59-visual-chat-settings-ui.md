# Plan 59 — 채팅 & 설정 UI 비주얼 (Visual Chat & Settings UI)

## 개요

plan 33(채팅 시스템)·plan 37(ESC 메뉴·설정)·plan 26(사운드 시스템)에서  
로직만 정의된 채팅 패널, 설정 패널, 음량 슬라이더의 시각 표현을 설계한다.  
채팅 입력창, 메시지 로그, 설정 슬라이더, 음소거 아이콘,  
ESC 메뉴 레이아웃, 그래픽 품질 토글을 포함한다.

---

## 1. 채팅 패널 (`ChatPanel`)

### 1-1. 레이아웃

```
화면 좌하단 고정 (ScrollFactor 0)

┌──────────────────────────────────────────────────┐ ← 로그 패널 (320×120px)
│  [시스템] usejen_id 님이 입장했습니다.             │
│  usejen_id: 안녕하세요!                           │
│  [시스템] 적 침공이 시작됩니다!                   │ ← 시스템 메시지 (주황)
│  플레이어2: 같이 싸우자                           │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐ ← 입력창 (Enter로 활성화)
│ > _                                               │
└──────────────────────────────────────────────────┘
```

위치: `x: 8, y: height - 168`  
평소: 로그 패널만 반투명 (alpha 0.65) / 마우스 호버 또는 새 메시지 도착 시 alpha 0.92

### 1-2. 메시지 타입별 색상

```typescript
const CHAT_MESSAGE_COLORS: Record<ChatMessageType, string> = {
  user:    '#e8d8b0',    // 플레이어 메시지: 크림색
  system:  '#f09040',    // 시스템 메시지: 주황
  join:    '#60e080',    // 입장: 초록
  leave:   '#e06060',    // 퇴장: 빨강
  death:   '#e04040',    // 사망: 진빨강
  combat:  '#ff8080',    // 전투 알림: 살구
};
```

### 1-3. 채팅 로그 패널 렌더링 (Canvas)

```typescript
function drawChatLog(
  ctx: CanvasRenderingContext2D,
  messages: ChatMessage[],   // 최신 순, 최대 8개 표시
  W: number, H: number
): void {
  // 배경
  ctx.fillStyle = 'rgba(10, 8, 5, 0.0)';   // 투명 (컨테이너가 alpha 관리)
  ctx.clearRect(0, 0, W, H);

  // 최신 메시지가 하단에 오도록 역순 렌더링
  const visible = messages.slice(-8);
  visible.forEach((msg, i) => {
    const y = H - 16 - (visible.length - 1 - i) * 14;

    // 플레이어 이름 색상 (plan 52 PLAYER_COLORS)
    if (msg.type === 'user') {
      ctx.fillStyle = msg.playerColor ?? '#aaaaaa';
      ctx.font = 'bold 9px Courier New';
      ctx.fillText(`${msg.playerName}:`, 4, y);
      const nameW = ctx.measureText(`${msg.playerName}: `).width;

      ctx.fillStyle = CHAT_MESSAGE_COLORS.user;
      ctx.font = '9px Courier New';
      ctx.fillText(msg.text, 4 + nameW, y);
    } else {
      ctx.fillStyle = CHAT_MESSAGE_COLORS[msg.type] ?? '#f09040';
      ctx.font = 'italic 9px Courier New';
      ctx.fillText(`[${getSystemLabel(msg.type)}] ${msg.text}`, 4, y);
    }
  });
}
```

### 1-4. 채팅 입력창

```typescript
class ChatInputBox {
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private cursor: Phaser.GameObjects.Graphics;
  private cursorBlink: Phaser.Tweens.Tween;

  activate(): void {
    this.bg.setVisible(true).setAlpha(0);
    scene.tweens.add({ targets: this.bg, alpha: 1, duration: 120 });

    // 커서 깜빡임 (0.5s)
    this.cursor.setVisible(true);
    this.cursorBlink = scene.tweens.add({
      targets: this.cursor, alpha: { from: 1, to: 0 },
      duration: 500, yoyo: true, repeat: -1
    });

    // 입력창 활성화 시 좌측 > 프롬프트 표시
    this.text.setText('> ');
  }

  deactivate(): void {
    this.cursorBlink?.stop();
    this.cursor.setVisible(false);
    scene.tweens.add({
      targets: this.bg, alpha: 0, duration: 150,
      onComplete: () => this.bg.setVisible(false)
    });
  }

  // 전송 애니메이션: 텍스트 우측으로 fade out
  playSendAnimation(): void {
    scene.tweens.add({
      targets: this.text,
      x: this.text.x + 20, alpha: 0,
      duration: 150,
      onComplete: () => {
        this.text.setText('> ').setX(this.originX).setAlpha(1);
      }
    });
  }
}
```

### 1-5. 새 메시지 도착 알림

채팅 패널이 접혀 있을 때 새 메시지 → 패널 상단 알림 뱃지:

```typescript
function showNewMessageBadge(count: number): void {
  if (!chatBadge) {
    chatBadge = scene.add.text(8, scene.cameras.main.height - 172, '',
      { fontSize: '9px', fontFamily: 'Courier New',
        color: '#1a1008', backgroundColor: '#f0c030',
        padding: { x: 4, y: 2 } }
    ).setScrollFactor(0).setDepth(87);
  }
  chatBadge.setText(`+${count}`).setVisible(true);

  // 3s 뒤 자동 숨김
  scene.time.delayedCall(3000, () => chatBadge?.setVisible(false));
}
```

---

## 2. ESC 메뉴 비주얼 (`EscMenuRenderer`)

plan 37에서 구조만 정의됨 → 외형 설계.

### 2-1. ESC 메뉴 레이아웃

```
화면 중앙, 200×280px

┌──────────── ⚙ 메뉴 ────────────┐
│                                  │
│      ▶ 게임 재개                 │  ← [R]
│        설 정                     │  → 설정 서브메뉴
│        도움말                    │  → Cheatsheet (plan 54)
│        타이틀로                  │  ← 경고 후 이동
│        게임 종료                 │  ← 확인 다이얼로그
│                                  │
│   v0.59.0   2026-04-10 22:14     │
└──────────────────────────────────┘
```

```typescript
function drawEscMenu(ctx: CanvasRenderingContext2D, selectedIdx: number): void {
  const W = 200, H = 280;
  const cx = W / 2;

  // 배경
  ctx.fillStyle = 'rgba(10, 8, 5, 0.96)';
  roundRect(ctx, 0, 0, W, H, 6); ctx.fill();
  ctx.strokeStyle = '#5a4428'; ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, W, H, 6); ctx.stroke();

  // 상단 황금 accent bar
  ctx.fillStyle = '#f0c030';
  ctx.fillRect(0, 0, W, 3);

  // 타이틀
  ctx.fillStyle = '#e8d8b0';
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('⚙ 메뉴', cx, 24);

  // 메뉴 항목
  const items = ['▶ 게임 재개', '설 정', '도움말', '타이틀로', '게임 종료'];
  items.forEach((label, i) => {
    const y = 56 + i * 36;
    const isSelected = i === selectedIdx;

    if (isSelected) {
      // 선택 배경
      ctx.fillStyle = 'rgba(240,192,48,0.15)';
      roundRect(ctx, 16, y - 14, W - 32, 24, 3); ctx.fill();
      // 좌측 accent bar
      ctx.fillStyle = '#f0c030';
      ctx.fillRect(16, y - 12, 3, 20);
    }

    ctx.fillStyle = isSelected ? '#f0c030' : '#c8b88a';
    ctx.font = isSelected ? 'bold 11px Courier New' : '11px Courier New';
    ctx.fillText(label, cx, y + 4);
  });

  // 하단 버전·시간
  ctx.fillStyle = '#6a5a38';
  ctx.font = '8px Courier New';
  ctx.fillText(`v0.59.0   ${getCurrentDateStr()}`, cx, H - 12);
}
```

### 2-2. ESC 메뉴 열기/닫기 tween

```typescript
// 열기: 중앙 scale 0.85→1.0, alpha 0→1 (0.2s Back.easeOut)
// 닫기: scale 1.0→0.85, alpha 1→0 (0.15s)
// 배경 딤: 0.5 alpha (plan 50 vignette 일시 강화)
```

---

## 3. 설정 패널 (`SettingsPanel`)

plan 37 `GameSettings`: `sv_settings` localStorage에 저장되는 4개 설정.

### 3-1. 슬라이더 컴포넌트 (`drawSlider`)

```typescript
function drawSlider(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: number,    // 0.0 ~ 1.0
  x: number, y: number, w: number
): void {
  // 레이블
  ctx.fillStyle = '#c8b88a';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 4);

  // 트랙
  ctx.fillStyle = '#2a2010';
  roundRect(ctx, x, y, w, 6, 3); ctx.fill();

  // 채움
  ctx.fillStyle = '#c8a030';
  roundRect(ctx, x, y, w * value, 6, 3); ctx.fill();

  // 핸들 (원형)
  const hx = x + w * value;
  ctx.fillStyle = '#f0c030';
  ctx.beginPath(); ctx.arc(hx, y + 3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a07020'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(hx, y + 3, 6, 0, Math.PI * 2); ctx.stroke();

  // 수치 (오른쪽)
  ctx.fillStyle = '#e8d8b0';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(value * 100)}`, x + w + 24, y + 5);
}
```

### 3-2. 토글 스위치 (`drawToggle`)

```typescript
function drawToggle(
  ctx: CanvasRenderingContext2D,
  label: string,
  on: boolean,
  x: number, y: number
): void {
  // 레이블
  ctx.fillStyle = '#c8b88a';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + 10);

  // 트랙 (32×16px)
  const tx = x + 130;
  ctx.fillStyle = on ? '#60a040' : '#3a2a14';
  roundRect(ctx, tx, y, 32, 16, 8); ctx.fill();
  ctx.strokeStyle = on ? '#80c060' : '#6a5030'; ctx.lineWidth = 1;
  roundRect(ctx, tx, y, 32, 16, 8); ctx.stroke();

  // 핸들
  const hx = on ? tx + 18 : tx + 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(hx + 6, y + 8, 5, 0, Math.PI * 2); ctx.fill();
}
```

### 3-3. 설정 패널 전체 레이아웃

```
┌─────────────────── 설 정 ────────────────────┐
│                                                │
│  BGM 음량       ━━━━━━━━━━━━━●━━━━  75        │
│  효과음 음량    ━━━━━━━━━━●━━━━━━━  60        │
│                                                │
│  FPS 표시       [ ON  ]                        │
│  좌표 표시      [ OFF ]                        │
│  언어           [ 한국어 ▼ ]                   │
│  그래픽 품질    [ 보통  ▼ ]                    │
│                                                │
│              [기본값으로]    [닫기]             │
└────────────────────────────────────────────────┘
```

### 3-4. 드롭다운 컴포넌트 (`drawDropdown`)

```typescript
function drawDropdown(
  ctx: CanvasRenderingContext2D,
  label: string,
  options: string[],
  selectedIdx: number,
  x: number, y: number, w: number
): void {
  ctx.fillStyle = '#c8b88a';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + 10);

  const dx = x + 130;
  ctx.fillStyle = '#2a2010';
  roundRect(ctx, dx, y, w, 20, 3); ctx.fill();
  ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 1;
  roundRect(ctx, dx, y, w, 20, 3); ctx.stroke();

  ctx.fillStyle = '#e8d8b0';
  ctx.font = '10px Courier New';
  ctx.fillText(options[selectedIdx], dx + 6, y + 13);

  // 화살표 ▼
  ctx.fillStyle = '#c8a030';
  ctx.font = 'bold 8px Courier New';
  ctx.textAlign = 'right';
  ctx.fillText('▼', dx + w - 4, y + 13);
}
```

---

## 4. 음소거 아이콘 애니메이션 (`MuteIcon`)

```typescript
class MuteIcon {
  private gfx: Phaser.GameObjects.Graphics;

  // 음량 0일 때 화면 우하단 음소거 아이콘 표시
  show(isMuted: boolean): void {
    const cam = scene.cameras.main;
    const x = cam.width - 28, y = cam.height - 28;

    this.gfx?.destroy();
    this.gfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(88);

    if (isMuted) {
      // 스피커 X 아이콘 (16×16px)
      this.gfx.fillStyle(0xe04040, 0.85);
      // 스피커 본체
      this.gfx.fillRect(x, y + 4, 5, 8);
      this.gfx.fillTriangle(x + 5, y + 1, x + 5, y + 15, x + 11, y + 8);
      // X 표시
      this.gfx.lineStyle(2, 0xe04040, 1.0);
      this.gfx.lineBetween(x + 13, y + 4, x + 17, y + 12);
      this.gfx.lineBetween(x + 17, y + 4, x + 13, y + 12);

      // 진입 pulse 애니
      this.gfx.setAlpha(0);
      scene.tweens.add({ targets: this.gfx, alpha: 0.85, duration: 300 });
    } else {
      // 음량 레벨에 따른 파동선 표시 (낮음/중간/높음)
      this.drawSpeakerWaves(x, y, getVolume());
    }
  }

  private drawSpeakerWaves(x: number, y: number, vol: number): void {
    const arcs = vol > 0.6 ? 3 : vol > 0.3 ? 2 : 1;
    this.gfx.lineStyle(1.5, 0xc8b88a, 0.7);
    for (let i = 0; i < arcs; i++) {
      const r = 5 + i * 4;
      this.gfx.beginPath();
      this.gfx.arc(x + 10, y + 8, r, -0.6, 0.6);
      this.gfx.strokePath();
    }
  }
}
```

---

## 5. FPS 카운터 & 좌표 표시 (설정 `showFps`, `showCoords`)

```typescript
class DebugHUD {
  private fpsText: Phaser.GameObjects.Text;
  private coordText: Phaser.GameObjects.Text;

  update(delta: number, playerTX: number, playerTY: number): void {
    const fps = Math.round(1000 / delta);

    if (GameSettings.showFps) {
      const color = fps >= 55 ? '#60e060' : fps >= 30 ? '#e0c040' : '#e04040';
      this.fpsText
        .setText(`${fps} fps`)
        .setStyle({ color })
        .setVisible(true);
    } else {
      this.fpsText.setVisible(false);
    }

    if (GameSettings.showCoords) {
      this.coordText
        .setText(`(${playerTX}, ${playerTY})`)
        .setVisible(true);
    } else {
      this.coordText.setVisible(false);
    }
  }
}

// FPS 색상: 55+ 초록, 30~54 노랑, <30 빨강
// 위치: 화면 우상단 (plan 43 미니맵 아래)
```

---

## 6. 그래픽 품질 단계 (`GraphicsQuality`)

설정 패널의 "그래픽 품질" 옵션:

| 품질 | 파티클 수 | 날씨 파티클 | DynamicResolution |
|------|----------|-----------|-------------------|
| 낮음 | ×0.3 | ×0.3 | 75% scale |
| 보통 | ×0.6 | ×0.6 | 88% scale |
| 높음 | ×1.0 | ×1.0 | 100% scale |

```typescript
enum GraphicsQuality { Low = 0, Medium = 1, High = 2 }

function applyGraphicsQuality(q: GraphicsQuality): void {
  const multipliers = [0.3, 0.6, 1.0];
  const scales      = [0.75, 0.88, 1.0];
  GlobalParticleMultiplier = multipliers[q];
  DynamicResolution.forceScale(scales[q]);
}
```

---

## 7. 채팅 패널 페이드 자동화

```typescript
class ChatPanelAutoFade {
  private fadeTimer: Phaser.Time.TimerEvent | null = null;
  private readonly FADE_DELAY = 8000;   // 8s 무활동 시 반투명

  onNewMessage(): void {
    this.chatPanel.setAlpha(0.92);
    this.resetFadeTimer();
  }

  onHover(): void {
    this.chatPanel.setAlpha(0.92);
    this.fadeTimer?.remove();
  }

  onHoverOut(): void { this.resetFadeTimer(); }

  private resetFadeTimer(): void {
    this.fadeTimer?.remove();
    this.fadeTimer = scene.time.delayedCall(this.FADE_DELAY, () => {
      scene.tweens.add({
        targets: this.chatPanel,
        alpha: 0.35, duration: 1000
      });
    });
  }
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth | ScrollFactor |
|----------|-------|--------------|
| 채팅 로그 패널 | 86 | 0 |
| 채팅 입력창 | 87 | 0 |
| 채팅 새 메시지 뱃지 | 87 | 0 |
| 음소거 아이콘 | 88 | 0 |
| FPS / 좌표 텍스트 | 89 | 0 |
| ESC 메뉴 배경 딤 | 110 | 0 |
| ESC 메뉴 패널 | 111 | 0 |
| 설정 패널 | 112 | 0 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/ChatPanel.ts` | 로그 패널, 자동 fade, 새 메시지 뱃지 |
| `src/ui/ChatInputBox.ts` | 입력창, 커서 깜빡임, 전송 애니 |
| `src/ui/EscMenuRenderer.ts` | ESC 메뉴 레이아웃, 선택 하이라이트 |
| `src/ui/SettingsPanel.ts` | 슬라이더, 토글, 드롭다운 컴포넌트 |
| `src/ui/MuteIcon.ts` | 음소거/볼륨 아이콘 |
| `src/ui/DebugHUD.ts` | FPS 카운터, 좌표 표시 |
| `src/systems/GraphicsQuality.ts` | 품질 단계 파티클·해상도 적용 |

---

## 10. 버전

`v0.59.0`
