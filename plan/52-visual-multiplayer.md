# Plan 52 — 멀티플레이어 비주얼 시스템 (Visual Multiplayer)

## 개요

plan 20(멀티플레이어 Firebase), plan 33(채팅), plan 46(전투)을 바탕으로  
다른 플레이어의 시각 표현을 체계화한다.  
이름표·상태 아이콘·채팅 말풍선·핑 인디케이터·리스폰 연출을 포함한다.

---

## 1. 플레이어 이름표 (`PlayerNameTag`)

### 1-1. 레이아웃

```
    ┌─────────────────┐
    │ ❤ 80  🛡 25     │  ← 상태 아이콘 줄 (HP·SP bar)
    │   usejen_id     │  ← 플레이어 이름
    └─────────────────┘
          ▼ (캐릭터 머리 위 +4px)
    [캐릭터 스프라이트]
```

- 이름 표시: `Courier New bold 10px`, 흰색, 검정 stroke 1px
- 배경: `rgba(0, 0, 0, 0.45)` 라운드 rect (roundedRect 3px)
- 위치: 캐릭터 worldY − 40px (카메라 고정, setScrollFactor(1) 그대로)
- 본인 이름표: 노란 테두리 `#f0c030`, 타인: 흰 테두리 `#aaaaaa`

### 1-2. HP/SP 미니 게이지

```typescript
interface NameTagGauges {
  hp:    number;   // 0~100
  maxHp: number;
  sp:    number;   // 스태미나 0~100
}

function drawNameTagGauges(ctx: CanvasRenderingContext2D, g: NameTagGauges, w: number): void {
  const barW = w - 8, barH = 3, x = 4;

  // HP 게이지 (빨강)
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(x, 2, barW, barH);
  ctx.fillStyle = g.hp / g.maxHp > 0.3 ? '#e04040' : '#ff2020';
  ctx.fillRect(x, 2, barW * (g.hp / g.maxHp), barH);

  // SP 게이지 (파랑) — HP 아래 2px 간격
  ctx.fillStyle = '#10103a';
  ctx.fillRect(x, 7, barW, barH);
  ctx.fillStyle = '#4080e0';
  ctx.fillRect(x, 7, barW * (g.sp / 100), barH);
}
```

### 1-3. 상태 아이콘 (이름 우측)

| 상태 | 아이콘 문자 | 색 |
|------|------------|----|
| 수면 중 | 💤 | 하늘색 |
| 전투 중 | ⚔ | 빨강 |
| 요리/제작 | 🔨 | 주황 |
| 배고픔 낮음 | 🍖 | 황토 |
| 부상 (HP<30%) | 🩸 | 진빨강 |
| AFK (30초 무입력) | 💬? → AFK | 회색 |

```typescript
function getPlayerStatusIcons(state: RemotePlayerState): string[] {
  const icons: string[] = [];
  if (state.isSleeping)           icons.push('💤');
  if (state.isInCombat)           icons.push('⚔');
  if (state.isCrafting)           icons.push('🔨');
  if (state.hunger < 30)          icons.push('🍖');
  if (state.hp / state.maxHp < 0.3) icons.push('🩸');
  if (state.afkSeconds > 30)      icons.push('AFK');
  return icons;
}
```

---

## 2. 채팅 말풍선 (`ChatBubble`)

### 2-1. 말풍선 외형

```
┌──────────────────────────┐
│ 안녕하세요!               │  ← 텍스트 (최대 20자 줄바꿈)
└─────────┬────────────────┘
          │   ← 꼬리 (삼각형 6px)
        [캐릭터]
```

- 배경: `rgba(255, 255, 240, 0.92)` (크림색)
- 텍스트: `Courier New 10px`, `#1a1008`
- 최대 너비 140px (20자 후 줄바꿈)
- 최대 2줄 표시 후 `...` 말줄임
- 꼬리 삼각형: 캐릭터 머리 위 (-50px)

### 2-2. 말풍선 생명 주기

```typescript
class ChatBubble {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  show(message: string, duration: number = 4000): void {
    // 기존 말풍선 즉시 교체 (tween 취소)
    this.tween?.stop();
    this.text.setText(this.wrapText(message, 20));
    this.container.setAlpha(1).setVisible(true);
    this.resizeBg();

    // fadeIn 0.15s → hold → fadeOut 0.4s
    this.tween = scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 150,
      onComplete: () => {
        scene.time.delayedCall(duration, () => {
          scene.tweens.add({
            targets: this.container,
            alpha: 0, duration: 400,
            onComplete: () => this.container.setVisible(false)
          });
        });
      }
    });
  }

  private wrapText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    const lines: string[] = [];
    for (let i = 0; i < text.length && lines.length < 2; i += maxChars) {
      lines.push(text.slice(i, i + maxChars));
    }
    if (text.length > maxChars * 2) lines[1] = lines[1].slice(0, -1) + '…';
    return lines.join('\n');
  }
}
```

### 2-3. 감정 표현 (Emote)

채팅 입력 단축 명령 → 캐릭터 위 대형 이모지 팝업:

| 명령 | 이모지 | 설명 |
|------|-------|------|
| `/gg` | 👍 | 잘했어요 |
| `/help` | 🆘 | 도움 요청 |
| `/wave` | 👋 | 인사 |
| `/tired` | 😩 | 피로 |
| `/nice` | ✨ | 칭찬 |

```typescript
function showEmote(playerId: string, emote: string): void {
  const playerSprite = getPlayerSprite(playerId);
  if (!playerSprite) return;

  const txt = scene.add.text(playerSprite.x, playerSprite.y - 60, emote, {
    fontSize: '24px'
  }).setDepth(92).setOrigin(0.5);

  // Back.easeOut scale punch + 2.5s 뒤 fade
  scene.tweens.add({
    targets: txt,
    scaleX: [0.3, 1.2, 1.0], scaleY: [0.3, 1.2, 1.0],
    duration: 350, ease: 'Back.easeOut'
  });
  scene.time.delayedCall(2500, () => {
    scene.tweens.add({
      targets: txt, alpha: 0, y: txt.y - 16,
      duration: 400, onComplete: () => txt.destroy()
    });
  });
}
```

---

## 3. 원거리 플레이어 방향 인디케이터

화면 밖 플레이어를 화면 가장자리 화살표로 표시:

```typescript
class RemotePlayerDirectionIndicator {
  private arrows = new Map<string, Phaser.GameObjects.Container>();

  update(remoteStates: RemotePlayerState[]): void {
    const camBounds = scene.cameras.main.worldView;

    for (const state of remoteStates) {
      const inView = camBounds.contains(state.worldX, state.worldY);
      if (inView) {
        this.hideArrow(state.playerId);
        continue;
      }

      // 화면 가장자리 클램핑
      const angle = Math.atan2(
        state.worldY - (camBounds.y + camBounds.height / 2),
        state.worldX - (camBounds.x + camBounds.width  / 2)
      );
      const edgePos = getEdgePosition(angle, camBounds, 24);
      this.showArrow(state.playerId, edgePos, angle, state.playerColor);
    }
  }

  private showArrow(
    id: string,
    pos: { x: number; y: number },
    angle: number,
    color: number
  ): void {
    let c = this.arrows.get(id);
    if (!c) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(color, 0.85);
      // 삼각형 화살표 (12×16px)
      gfx.fillTriangle(0, -8, -6, 8, 6, 8);
      // 플레이어 이니셜 또는 색 원
      gfx.fillStyle(0x000000, 0.5).fillCircle(0, 4, 4);

      c = scene.add.container(pos.x, pos.y, [gfx]);
      c.setDepth(95).setScrollFactor(0);
      this.arrows.set(id, c);
    }
    c.setPosition(pos.x, pos.y).setRotation(angle + Math.PI / 2);
    c.setVisible(true);

    // 0.8s yoyo alpha 깜빡임
    scene.tweens.add({
      targets: c, alpha: { from: 1, to: 0.4 },
      duration: 800, yoyo: true, repeat: -1, paused: false
    });
  }
}
```

---

## 4. 피해 공유 시각 (`SharedDamageIndicator`)

멀티플레이에서 내 시야 밖 아군이 피해를 받으면:

```typescript
// 화면 가장자리에 빨간 방향 플래시 (plan 46 flashHitVignette 변형)
function showAllyDamageFlash(direction: 'north'|'south'|'east'|'west'): void {
  const cam = scene.cameras.main;
  const W = cam.width, H = cam.height;

  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(105);
  gfx.fillStyle(0xff2020, 0.0);

  // 방향에 따른 그라디언트 사각형
  const rects: Record<string, [number, number, number, number]> = {
    north: [0,     0,     W,  40],
    south: [0,     H-40, W,  40],
    east:  [W-40, 0,     40, H],
    west:  [0,     0,     40, H],
  };
  const [x, y, w, h] = rects[direction];
  gfx.fillRect(x, y, w, h);

  scene.tweens.add({
    targets: gfx,
    alpha: { from: 0, to: 0.5 },
    duration: 150, yoyo: true,
    onComplete: () => gfx.destroy()
  });
}
```

---

## 5. 리스폰 연출 (`RespawnEffect`)

### 5-1. 사망 후 리스폰 카운트다운 (plan 44 사망 패널 연계)

```typescript
function showRespawnCountdown(seconds: number): void {
  const cam = scene.cameras.main;
  const txt = scene.add.text(cam.width / 2, cam.height / 2 + 60,
    `리스폰까지 ${seconds}초...`, {
      fontSize: '13px', fontFamily: 'Courier New bold',
      color: '#cccccc', stroke: '#000000', strokeThickness: 2
    }
  ).setScrollFactor(0).setDepth(128).setOrigin(0.5);

  const interval = scene.time.addEvent({
    delay: 1000, repeat: seconds - 1,
    callback: () => {
      seconds--;
      txt.setText(seconds > 0 ? `리스폰까지 ${seconds}초...` : '리스폰!');
      if (seconds === 0) {
        scene.tweens.add({
          targets: txt, alpha: 0, duration: 800,
          onComplete: () => { txt.destroy(); interval.remove(); }
        });
      }
    }
  });
}
```

### 5-2. 리스폰 위치 도착 이펙트

```typescript
function playRespawnArrivalEffect(worldX: number, worldY: number): void {
  // 1. 흰 원형 확장 (반경 0 → 48px, 0.5s, alpha 0.8→0)
  const gfx = scene.add.graphics().setDepth(70);
  let r = 0;
  const tween = scene.tweens.add({
    targets: { r: 0 }, r: 48,
    duration: 500, ease: 'Quad.easeOut',
    onUpdate: (tw, obj) => {
      gfx.clear();
      gfx.lineStyle(2, 0xffffff, 1 - obj.r / 48);
      gfx.strokeCircle(worldX, worldY, obj.r);
    },
    onComplete: () => gfx.destroy()
  });

  // 2. 별 파티클 8개 퍼짐
  const emitter = scene.add.particles(worldX, worldY, 'fx_pixel', {
    tint:    [0xffffff, 0xffeeaa, 0xaaddff],
    speed:   { min: 60, max: 120 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 1.5, end: 0 },
    lifespan: 600,
    quantity: 8,
    emitting: false
  });
  emitter.explode(8);
  scene.time.delayedCall(700, () => emitter.destroy());

  // 3. 플레이어 alpha 0 → 1 (0.6s fadeIn)
  const playerSprite = getLocalPlayerSprite();
  playerSprite.setAlpha(0);
  scene.tweens.add({ targets: playerSprite, alpha: 1, duration: 600 });
}
```

---

## 6. 미니맵 플레이어 마커 (plan 43 MiniMap 확장)

```typescript
// plan 43 MiniMap 렌더링에 추가
function drawRemotePlayerDots(
  ctx: CanvasRenderingContext2D,
  remoteStates: RemotePlayerState[],
  mapOffsetX: number, mapOffsetY: number, tileSize: number
): void {
  for (const state of remoteStates) {
    const mx = mapOffsetX + Math.floor(state.worldX / 32) * tileSize;
    const my = mapOffsetY + Math.floor(state.worldY / 32) * tileSize;

    // 플레이어 색상 점 (4×4px)
    ctx.fillStyle = '#' + state.playerColor.toString(16).padStart(6, '0');
    ctx.fillRect(mx - 2, my - 2, 4, 4);

    // 이름 첫 글자 툴팁 (hover 시)
    // → MouseMove 이벤트로 미니맵 좌표 역산하여 표시
  }
}
```

### 플레이어 색상 팔레트

각 플레이어는 입장 순서로 색상 할당 (Firebase uid 해시 기반):

```typescript
const PLAYER_COLORS = [
  0xe04040,  // 빨강
  0x4080e0,  // 파랑
  0x40c060,  // 초록
  0xe0a020,  // 주황
  0xc040c0,  // 보라
  0x40c0c0,  // 청록
  0xe0e040,  // 노랑
  0xe06080,  // 분홍
];

function assignPlayerColor(uid: string): number {
  // uid 문자 코드 합산 → mod 8
  const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
}
```

---

## 7. 접속/퇴장 알림 시각 (plan 37 NotifySystem 연계)

```typescript
// plan 37 NotifySystem.show() 타입 확장
// type: 'join' | 'leave' 추가

const JOIN_LEAVE_STYLE: Record<'join'|'leave', { icon: string; color: number }> = {
  join:  { icon: '→', color: 0x40c060 },
  leave: { icon: '←', color: 0xe04040 },
};

// 사용 예
NotifySystem.show('join',  `${name}님이 입장했습니다.`);
NotifySystem.show('leave', `${name}님이 퇴장했습니다.`);
```

추가로 **월드 지도 진입 지점**에 2s 동안 플레이어 이름 팝업 표시:

```typescript
function showJoinLocationPopup(worldX: number, worldY: number, name: string): void {
  const popup = scene.add.text(worldX, worldY - 56, `${name} 입장`, {
    fontSize: '10px', fontFamily: 'Courier New',
    color: '#aaffaa', stroke: '#000000', strokeThickness: 2
  }).setDepth(91).setOrigin(0.5);

  scene.tweens.add({
    targets: popup, y: popup.y - 20, alpha: { from: 1, to: 0 },
    duration: 2000, ease: 'Quad.easeOut',
    onComplete: () => popup.destroy()
  });
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 원거리 플레이어 방향 화살표 | 95 (ScrollFactor 0) |
| 채팅 말풍선 | 88 |
| 이름표 | 86 |
| 감정 표현 이모지 | 92 |
| 리스폰 도착 링 | 70 |
| 아군 피해 플래시 | 105 (ScrollFactor 0) |
| 리스폰 카운트다운 텍스트 | 128 (ScrollFactor 0) |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/PlayerNameTag.ts` | 이름표, HP/SP 게이지, 상태 아이콘 |
| `src/ui/ChatBubble.ts` | 말풍선 표시/줄바꿈/fade |
| `src/ui/RemotePlayerIndicator.ts` | 화면 밖 방향 화살표, 피해 플래시 |
| `src/systems/RespawnEffect.ts` | 카운트다운, 도착 이펙트 |
| `src/systems/MultiplayerVisualSystem.ts` | 전체 원격 플레이어 비주얼 통합 관리 |
| `src/generators/SpriteGenerator.ts` | assignPlayerColor 유틸 추가 |

---

## 10. 버전

`v0.52.0`
