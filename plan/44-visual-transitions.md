# 설계 44 — 화면 전환 & 씬 이펙트

> **전제 조건**: 01~43 단계 완료 상태.
> plan 19(타이틀·로딩), plan 21(맵 전환), plan 23(수면), plan 25(사망),
> plan 43(UI 색상 시스템)을 기반으로 모든 화면 전환의 시각 연출을 확정한다.

---

## 1. 이번 단계 목표

1. **타이틀 → 게임 진입** — 로딩 화면 + 씬 페이드인
2. **맵 전환** — 방향별 슬라이드 + 페이드 조합
3. **수면 전환** — 눈 감김 → 시간 경과 → 눈 뜨임
4. **사망 화면** — 레드 빈네트 → 화면 암전 → 결과 패널
5. **계절 전환 연출** — 하늘 색조 서서히 변화
6. **낮/밤 전환** — 조명 그라디언트 페이드

---

## 2. 타이틀 → 게임 진입

### 2-1. 로딩 화면 외형 (plan 19 확장)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                  ⛺ BASECAMP                     │  ← 타이틀 (24px, 크림색)
│              생존 시뮬레이션                       │  ← 부제 (12px, 회갈색)
│                                                  │
│          ████████████████░░░░░░░░░░              │  ← 진행 바 240×10px
│           맵을 생성하고 있습니다...               │  ← 상태 텍스트
│                                                  │
│                     62%                          │
└──────────────────────────────────────────────────┘
배경: 어두운 갈색 (0x0e0a06) → 게임 씬 배경과 연결
```

```typescript
// 진행 바 드로잉 (UIRenderer.drawGauge 재사용)
// 상태 텍스트 단계 (plan 19 기반):
const LOAD_STAGES = [
  { pct: 10,  text: '맵을 생성하고 있습니다...' },
  { pct: 35,  text: '나무와 강을 배치하는 중...' },
  { pct: 55,  text: '오브젝트를 로드하는 중...' },
  { pct: 75,  text: 'Firebase에 연결하는 중...' },
  { pct: 90,  text: '스프라이트를 준비하는 중...' },
  { pct: 100, text: '완료!' },
];
```

### 2-2. 로딩 완료 → 게임 진입 전환

```typescript
// 1. 로딩 바 100% 도달
// 2. 0.3초 대기
// 3. 화면 전체 흰색 플래시 (0→0.8→0, 0.4초) — 눈이 밝아지는 느낌
// 4. GameScene 시작 + 알파 0에서 페이드인 (0.6초)

scene.cameras.main.flash(400, 255, 255, 255, false, () => {
  scene.scene.start('GameScene', { seed, playerData });
});

// GameScene create():
scene.cameras.main.fadeIn(600, 0, 0, 0);
```

---

## 3. 맵 전환 (plan 21 확장)

### 3-1. 방향별 슬라이드

```typescript
type MapExitDir = 'right' | 'left' | 'up' | 'down';

const SLIDE_VECTORS: Record<MapExitDir, { x: number; y: number }> = {
  right: { x: -800, y: 0 },   // 현재 맵 왼쪽으로 사라짐
  left:  { x:  800, y: 0 },
  down:  { x: 0,   y: -600 },
  up:    { x: 0,   y:  600 },
};

function transitionMap(dir: MapExitDir): void {
  const vec = SLIDE_VECTORS[dir];

  // 1. 현재 맵 슬라이드 아웃 (0.25초)
  scene.tweens.add({
    targets: currentMapContainer,
    x: vec.x, y: vec.y,
    alpha: 0.5,
    duration: 250,
    ease: 'Quad.easeIn',
  });

  // 2. 동시에: 새 맵 반대편에서 슬라이드인 (0.25초 딜레이)
  newMapContainer.setPosition(-vec.x * 0.6, -vec.y * 0.6).setAlpha(0);
  scene.tweens.add({
    targets: newMapContainer,
    x: 0, y: 0, alpha: 1,
    duration: 250, delay: 180,
    ease: 'Quad.easeOut',
  });

  // 3. 경계 통과 순간 흰 플래시 (1프레임)
  scene.time.delayedCall(200, () => {
    scene.cameras.main.flash(80, 255, 255, 255, false);
  });
}
```

### 3-2. 전환 중 플레이어 위치

전환 애니메이션(0.4초) 동안:
- 플레이어 입력 차단
- 플레이어 스프라이트: 이동 방향으로 계속 걷는 애니메이션 유지
- HUD는 전환 내내 표시 유지 (패널만 닫힘)

---

## 4. 수면 전환

### 4-1. 잠드는 연출

```typescript
function sleepFadeOut(): void {
  // 1. 화면 가장자리부터 검정 빈네트 확장 (눈 감기는 효과)
  //    Phaser RenderTexture: 중앙 타원형 투명 구멍이 점점 작아짐
  const overlay = scene.add.renderTexture(0, 0, 800, 600).setDepth(100);

  let progress = 0;
  const timer = scene.time.addEvent({
    delay: 16, repeat: 60,
    callback: () => {
      progress += 1 / 60;                   // 1초에 걸쳐 완전히 감김
      overlay.clear();
      overlay.fill(0x000000, 1.0);
      // 중앙 타원 구멍 (erase 블렌드)
      const gfx = scene.make.graphics({ add: false });
      const rx = (1 - progress) * 420;     // 수평 반경 점점 작아짐
      const ry = (1 - Phaser.Math.Easing.Cubic.InOut(progress)) * 150;  // 수직 더 빠르게 감김
      gfx.fillEllipse(400, 300, rx * 2, ry * 2);
      overlay.erase(gfx); gfx.destroy();
    },
    callbackScope: this,
  });

  // 2. 완전히 감기면 (1초 후): ZZZ 파티클 잠깐 재생 후 시간 스킵
  scene.time.delayedCall(1000, () => {
    showSleepTimeSkip();
  });
}
```

### 4-2. 수면 중 시간 경과 표시

```
[검정 화면]

     💤 수면 중...
     봄 3일 22:30  →  봄 4일 06:00

     [████████████████████] 100%
```

```typescript
// 시간 텍스트 카운트업 (4배속 시간 = 현실 1분 52초)
// 실제 게임 시간을 표시하며 수면 종료 시각까지 빠르게 카운트
const clockText = scene.add.text(400, 300, '', {
  fontSize: '14px', fontFamily: 'Courier New',
  color: '#a09070', align: 'center',
}).setOrigin(0.5);

scene.time.addEvent({
  delay: 50, repeat: -1,
  callback: () => {
    clockText.setText(`${formatGameTime(currentTime)}`);
    if (currentTime >= wakeTime) wakeUp();
  },
});
```

### 4-3. 기상 연출

```typescript
function wakeUp(): void {
  // 수면 역방향: 타원 구멍이 다시 열림 (0.8초, 부드럽게)
  // 열리는 속도: 잠드는 것보다 약간 빠르게 (기상 후 눈이 빨리 뜨임)
  animateEyelidOpen(800);

  // 기상 시 화면 잠깐 노란빛 (아침 햇살)
  scene.time.delayedCall(400, () => {
    scene.cameras.main.flash(300, 255, 240, 180, false);
  });

  // 피로 회복 토스트 (plan 37)
  scene.time.delayedCall(900, () => {
    notifySystem.show('😴 잘 잤습니다. 피로가 회복되었습니다.', 'success');
  });
}
```

---

## 5. 사망 화면

### 5-1. 사망 연출 시퀀스

```typescript
function onPlayerDeath(): void {
  // 1단계 (0~0.5초): 빨간 빈네트 강화 + 화면 슬로우모션
  scene.cameras.main.postFX.addVignette(0.5, 0.5, 0.4, 0.8);
  scene.time.timeScale = 0.3;

  // 2단계 (0.5~1.2초): 채도 제거 (흑백으로)
  scene.time.delayedCall(500, () => {
    scene.cameras.main.postFX.addColorMatrix().desaturate(1.0);
    scene.time.timeScale = 0.1;
  });

  // 3단계 (1.2~2초): 완전 암전
  scene.time.delayedCall(1200, () => {
    scene.cameras.main.fade(800, 0, 0, 0);
  });

  // 4단계 (2초): 결과 패널 표시
  scene.time.delayedCall(2000, () => {
    scene.time.timeScale = 1.0;
    showDeathPanel();
  });
}
```

### 5-2. 사망 결과 패널

```
┌───────────────────────────────────────────┐
│                                           │
│           💀  사망했습니다                 │  ← 빨간색
│                                           │
│    생존 기간:  봄 1일 ~ 봄 4일  (3일)     │
│    최대 HP:    120                        │
│    처치한 적:  7마리                      │
│    건설한 구조물: 12개                    │
│                                           │
│  ─────────────────────────────────────── │
│                                           │
│  [타이틀로]              [다시 시작]       │
│                                           │
└───────────────────────────────────────────┘
패널 크기: 380×280px, 중앙 배치
패널 등장: 위에서 아래로 슬라이드인 (scaleY 0→1, 0.4초 Bounce.easeOut)
```

---

## 6. 계절 전환 연출

### 6-1. 하늘 색조 변화

```typescript
// 계절별 하늘(배경) 색상 — 맵 배경 색에 반영
const SKY_COLORS: Record<Season, number> = {
  spring: 0x8ec8f0,   // 연한 하늘색
  summer: 0x60b0f0,   // 밝고 진한 하늘
  autumn: 0xe0a860,   // 황혼빛 오렌지
  winter: 0xb0c8e0,   // 회청색 흐린 하늘
};

// 계절 전환 시 30초(현실)에 걸쳐 배경색 lerp
scene.tweens.add({
  targets: backgroundRect,
  // Phaser tween으로 직접 색 지정 불가 → onUpdate에서 setFillStyle
  duration: 30_000,
  onUpdate: (tween) => {
    const c = lerpColor(prevSkyColor, SKY_COLORS[newSeason], tween.progress);
    backgroundRect.setFillStyle(c);
  },
});
```

### 6-2. 계절 전환 알림 카드

```
┌─────────────────────────────────────────────┐
│                                             │
│   🌸 봄이 왔습니다                           │  ← 중앙 상단, 3초 표시
│   따뜻한 바람과 함께 새로운 시작            │
│                                             │
└─────────────────────────────────────────────┘
  너비: 280px, 배경 반투명
  등장: fadeIn 0.5초 → 2초 유지 → fadeOut 0.5초
  위치: 화면 상단 중앙 (y: 80px)
```

```typescript
const SEASON_CARDS: Record<Season, { icon: string; title: string; sub: string }> = {
  spring: { icon: '🌸', title: '봄이 왔습니다',    sub: '따뜻한 바람과 함께 새로운 시작' },
  summer: { icon: '☀',  title: '여름이 되었습니다', sub: '뜨거운 햇살, 자원이 풍부한 계절' },
  autumn: { icon: '🍂', title: '가을이 되었습니다', sub: '수확의 계절, 겨울을 준비하세요' },
  winter: { icon: '❄',  title: '겨울이 왔습니다',  sub: '혹독한 추위, 충분한 연료를 비축하세요' },
};
```

---

## 7. 낮/밤 전환 (plan 32 확장)

### 7-1. 하늘 색조 일주기

```typescript
// 시간대별 배경 색조 (암흑 레이어와 별도로 배경 자체도 변화)
function getSkyTint(gameHour: number): number {
  if (gameHour >= 5  && gameHour < 6)   // 새벽 여명: 보라→오렌지
    return lerpColor(0x1a0a2a, 0xff8830, (gameHour - 5));
  if (gameHour >= 6  && gameHour < 8)   // 아침: 오렌지→파랑
    return lerpColor(0xff8830, 0x8ec8f0, (gameHour - 6) / 2);
  if (gameHour >= 8  && gameHour < 18)  // 낮
    return SKY_COLORS[currentSeason];
  if (gameHour >= 18 && gameHour < 20)  // 저녁놀: 파랑→오렌지
    return lerpColor(SKY_COLORS[currentSeason], 0xe06020, (gameHour - 18) / 2);
  if (gameHour >= 20 && gameHour < 22)  // 황혼: 오렌지→남색
    return lerpColor(0xe06020, 0x0a0818, (gameHour - 20) / 2);
  return 0x0a0818;  // 밤: 진한 남색
}
```

### 7-2. 별 렌더링 (야간)

```typescript
// 22:00 이후 알파 서서히 증가, 06:00 이후 사라짐
// seed 기반 랜덤 위치 80개 별 (1~2px 흰 점)
// 일부 별 (10개) 는 0.5~2초 주기로 반짝임 (alpha 0.4→1.0 yoyo)

function generateStars(seed: string): Star[] {
  const rng = seedrandom(seed + '_stars');
  return Array.from({ length: 80 }, () => ({
    x: rng() * 800, y: rng() * 200,       // 화면 상단 1/3
    size: rng() < 0.2 ? 2 : 1,
    twinkle: rng() < 0.15,
    twinklePeriod: 500 + rng() * 1500,
  }));
}
```

---

## 8. TransitionSystem 클래스

```typescript
export class TransitionSystem {
  // 게임 진입
  playIntro(onComplete: () => void): void

  // 맵 전환
  playMapTransition(dir: MapExitDir, onMidpoint: () => void): void

  // 수면
  playSleepIn(onComplete: () => void): void
  playSleepOut(onComplete: () => void): void

  // 사망
  playDeathSequence(stats: DeathStats, onComplete: () => void): void

  // 계절 카드
  showSeasonCard(season: Season): void

  // 하늘 틴트 갱신 (매 프레임)
  update(gameHour: number, season: Season): void
}
```

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/TransitionSystem.ts` | 신규: 모든 화면 전환 연출 통합 |
| `src/ui/DeathPanel.ts` | 신규: 사망 결과 패널 |
| `src/ui/SeasonCard.ts` | 신규: 계절 전환 카드 |
| `src/rendering/StarLayer.ts` | 신규: 야간 별 렌더링 |
| `src/scenes/GameScene.ts` | TransitionSystem 통합, 배경 색조 갱신 |
| `src/scenes/LoadingScene.ts` | 로딩 진행 바 외형 + 완료 플래시 전환 |

---

## 10. 확정 규칙

- 맵 전환 슬라이드 중 플레이어 입력 완전 차단 (0.4초)
- 사망 슬로우모션(`timeScale 0.3`) 구간에 ESC 메뉴 열기 불가
- 수면 전환 눈꺼풀 애니메이션: RenderTexture erase 방식 (plan 32 DarknessLayer와 동일 패턴)
- 별 레이어: 낮(08:00~18:00) depth -1 설정으로 완전히 숨김 (렌더링 비용 절약)
- 계절 카드: 게임 첫 시작 시 봄 카드 미표시 (진입 시 이미 봄임을 알고 있음)
- 하늘 색조 일주기: 매 프레임 업데이트이나 변화량이 미미하므로 성능 영향 없음
- 로딩 완료 플래시: 싱글·멀티 공통, Firebase 연결 실패 시 오프라인 모드 텍스트 표시
