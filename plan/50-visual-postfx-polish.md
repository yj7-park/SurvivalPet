# 설계 50 — 포스트 프로세싱 & 화면 품질 마무리

> **전제 조건**: 01~49 단계 완료 상태.
> plan 40~49에서 설계한 모든 비주얼 요소를 하나로 묶어
> 게임 전체의 시각적 완성도를 높이는 후처리 이펙트와
> 렌더링 품질 설정을 확정한다.

---

## 1. 이번 단계 목표

1. **컬러 그레이딩** — 계절·날씨·시간대별 화면 색조 조정
2. **상시 빈네트** — 화면 가장자리 부드러운 어두움 (몰입감)
3. **픽셀 퍼펙트 카메라** — 타일 배열 흔들림 없는 정수 렌더
4. **화면 흔들림 시스템** — 강도·방향별 카메라 쉐이크 정규화
5. **동적 해상도** — 성능 부족 시 자동 해상도 조정
6. **전체 비주얼 QA 체크리스트** — plan 40~49 비주얼 통합 검증

---

## 2. 컬러 그레이딩

### 2-1. 계절별 색조 필터

```typescript
// Phaser 카메라 postFX.ColorMatrix 활용
// 각 계절마다 색온도·채도·밝기를 미세 조정

interface ColorGrade {
  saturation: number;   // -1~1  (0 = 무변화)
  brightness: number;   // -1~1
  hue:        number;   // 도 단위 (-180~180)
  contrast:   number;   // 0~2   (1 = 무변화)
}

const SEASON_GRADES: Record<Season, ColorGrade> = {
  spring: { saturation:  0.10, brightness:  0.03, hue:   5, contrast: 1.02 },
  summer: { saturation:  0.20, brightness:  0.05, hue:   0, contrast: 1.05 },
  autumn: { saturation:  0.05, brightness: -0.02, hue:  12, contrast: 1.08 },  // 붉은빛 강조
  winter: { saturation: -0.25, brightness: -0.05, hue:  -8, contrast: 0.96 },  // 차갑고 무채색
};

const WEATHER_GRADES: Record<WeatherType, Partial<ColorGrade>> = {
  clear:    {},
  cloudy:   { saturation: -0.10, brightness: -0.04 },
  rain:     { saturation: -0.15, brightness: -0.08, contrast: 0.95 },
  fog:      { saturation: -0.30, brightness:  0.05, contrast: 0.90 },
  snow:     { saturation: -0.20, brightness:  0.08 },
  storm:    { saturation: -0.20, brightness: -0.12, contrast: 0.92 },
  blizzard: { saturation: -0.40, brightness: -0.08, contrast: 0.88 },
  leaves:   { saturation:  0.10, hue: 8 },
};

function applyColorGrade(season: Season, weather: WeatherType, gameHour: number): void {
  const base    = SEASON_GRADES[season];
  const overlay = WEATHER_GRADES[weather];

  // 계절 + 날씨 합산 (클램프)
  const final: ColorGrade = {
    saturation: clamp(base.saturation + (overlay.saturation ?? 0), -1, 1),
    brightness: clamp(base.brightness + (overlay.brightness ?? 0), -1, 1),
    hue:        (base.hue ?? 0) + (overlay.hue ?? 0),
    contrast:   clamp((base.contrast ?? 1) * (overlay.contrast ?? 1), 0.5, 1.5),
  };

  // 야간 추가 보정: 채도 감소, 파랗게
  if (gameHour >= 22 || gameHour < 6) {
    final.saturation -= 0.15;
    final.hue -= 15;
  }

  const cm = scene.cameras.main.postFX.addColorMatrix();
  cm.saturate(final.saturation);
  cm.brightness(1 + final.brightness, false);
  cm.hue(final.hue, false);
  cm.contrast(final.contrast, false);
}
```

### 2-2. 색조 전환 보간

```typescript
// 날씨·시간 변경 시 ColorGrade를 즉시 변경하지 않고
// 매 프레임 lerp로 천천히 전환 (5초)
class ColorGradeTransition {
  private current: ColorGrade = { saturation:0, brightness:0, hue:0, contrast:1 };
  private target:  ColorGrade = { ...this.current };
  private speed = 1 / (5 * 60);   // 5초 = 300프레임

  setTarget(grade: ColorGrade): void { this.target = grade; }

  update(): void {
    this.current.saturation += (this.target.saturation - this.current.saturation) * this.speed * 60;
    this.current.brightness += (this.target.brightness - this.current.brightness) * this.speed * 60;
    this.current.hue        += (this.target.hue        - this.current.hue)        * this.speed * 60;
    this.current.contrast   += (this.target.contrast   - this.current.contrast)   * this.speed * 60;
    applyColorGradeRaw(this.current);
  }
}
```

---

## 3. 상시 빈네트 (Vignette)

```typescript
// 화면 전체에 상시 가장자리 어두움 오버레이
// RenderTexture: 중앙 투명 → 가장자리 반투명 검정

function createVignetteOverlay(scene: Phaser.Scene): Phaser.GameObjects.RenderTexture {
  const rt = scene.add.renderTexture(0, 0, 800, 600)
    .setScrollFactor(0).setDepth(95).setAlpha(1.0);

  const gfx = scene.make.graphics({ add: false });

  // 방사형 그라디언트 근사 (4단계 동심 사각형)
  const layers = [
    { pad: 0,   alpha: 0.35 },
    { pad: 80,  alpha: 0.20 },
    { pad: 160, alpha: 0.08 },
    { pad: 220, alpha: 0.00 },
  ];

  layers.forEach(({ pad, alpha }) => {
    gfx.fillStyle(0x000000, alpha);
    gfx.fillRect(pad, pad, 800 - pad*2, 600 - pad*2);
  });

  // 실제 가장자리만 어둡게: erase 방식으로 중앙 구멍 뚫기
  rt.fill(0x000000, 0.0);
  const vigGfx = scene.make.graphics({ add: false });
  vigGfx.fillStyle(0x000000, 1.0);
  // 바깥 테두리 4변 (각 60px 두께)
  [[0,0,800,60],[0,540,800,60],[0,0,60,600],[740,0,60,600]].forEach(([x,y,w,h]) => {
    vigGfx.fillRect(x,y,w,h);
  });
  // 모서리 추가 어두움
  [[0,0],[740,0],[0,540],[740,540]].forEach(([x,y]) => {
    vigGfx.fillStyle(0x000000, 0.2);
    vigGfx.fillRect(x, y, 60, 60);
  });

  rt.draw(vigGfx); vigGfx.destroy();
  return rt;
}

// 상황별 빈네트 강도 조절
const VIGNETTE_ALPHA: Record<string, number> = {
  normal:   0.30,   // 평상시
  night:    0.45,   // 야간
  indoor:   0.20,   // 실내 (약하게)
  danger:   0.50,   // HP 위험 (빨간 빈네트와 별개)
  blizzard: 0.55,   // 블리자드
};
```

---

## 4. 픽셀 퍼펙트 카메라

```typescript
// Phaser 카메라를 정수 좌표로 라운딩하여
// 타일 흔들림(sub-pixel rendering) 제거

class PixelPerfectCamera {
  private cam: Phaser.Cameras.Scene2D.Camera;

  constructor(cam: Phaser.Cameras.Scene2D.Camera) {
    this.cam = cam;
    cam.roundPixels = true;   // Phaser 기본 제공
  }

  // 카메라 스크롤을 정수로 강제
  follow(targetX: number, targetY: number): void {
    const scrollX = Math.round(targetX - this.cam.width  / 2);
    const scrollY = Math.round(targetY - this.cam.height / 2);
    this.cam.scrollX = scrollX;
    this.cam.scrollY = scrollY;
  }

  // 맵 경계 클램프 (plan 21 확장)
  clampToBounds(mapW: number, mapH: number): void {
    this.cam.scrollX = Math.round(clamp(this.cam.scrollX, 0, mapW  - this.cam.width));
    this.cam.scrollY = Math.round(clamp(this.cam.scrollY, 0, mapH - this.cam.height));
  }
}
```

---

## 5. 화면 흔들림 정규화

모든 카메라 쉐이크를 한 곳에서 관리:

```typescript
export class ScreenShakeSystem {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private queue: ShakeEvent[] = [];

  // 전체 쉐이크 강도 배율 (설정에서 0~1로 조절 가능)
  intensity: number = 1.0;

  shake(type: ShakeType): void {
    if (this.intensity === 0) return;
    const cfg = SHAKE_CONFIGS[type];
    this.cam.shake(cfg.duration, cfg.magnitude * this.intensity);
  }
}

const SHAKE_CONFIGS: Record<ShakeType, { duration: number; magnitude: number }> = {
  mine_hit:       { duration:  60, magnitude: 0.003 },   // 채굴 타격
  explosion:      { duration: 200, magnitude: 0.008 },   // 범위 폭발
  player_hit:     { duration: 100, magnitude: 0.005 },   // 플레이어 피격
  boss_attack:    { duration: 200, magnitude: 0.010 },   // 대장 공격
  tree_fall:      { duration: 150, magnitude: 0.004 },   // 나무 쓰러짐 착지
  thunder:        { duration: 300, magnitude: 0.006 },   // 천둥 (plan 45)
  map_transition: { duration:  80, magnitude: 0.002 },   // 맵 전환 순간
};
```

---

## 6. 동적 해상도

```typescript
// 60fps 미달 시 게임 캔버스 스케일 축소 (타일 크기 유지)
class DynamicResolution {
  private fpsHistory: number[] = [];
  private currentScale = 1.0;

  update(fps: number): void {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) this.fpsHistory.shift();

    const avgFps = this.fpsHistory.reduce((a,b)=>a+b,0) / this.fpsHistory.length;

    if (avgFps < 40 && this.currentScale > 0.75) {
      this.setScale(0.75);    // 해상도 75%
    } else if (avgFps < 50 && this.currentScale > 0.88) {
      this.setScale(0.88);    // 해상도 88%
    } else if (avgFps >= 58 && this.currentScale < 1.0) {
      this.setScale(1.0);     // 복구
    }
  }

  private setScale(s: number): void {
    if (this.currentScale === s) return;
    this.currentScale = s;
    game.scale.setGameSize(Math.floor(800 * s), Math.floor(600 * s));
    game.scale.setZoom(1 / s);   // CSS 줌으로 원래 크기 유지
  }
}
```

---

## 7. 렌더링 레이어 최종 확정표

plan 09에서 정의한 레이어 순서를 모든 비주얼 추가 후 재정비:

| Depth | 레이어 | 담당 |
|-------|--------|------|
| -1 | 별 레이어 (낮에 숨김) | plan 44 |
| 0 | 하늘 그라디언트 | plan 44 |
| 1 | 타일 (흙·물·암반) | plan 41 |
| 1.5 | 타일 장식 소품 | plan 41 |
| 2 | 경작지·야생 작물 | plan 39 |
| 3 | 지면 아이템 | plan 47 |
| 3.5 | 실내 따뜻한 오버레이 | plan 49 |
| 4 | 구조물 하단 (벽·문) | plan 02 |
| 5 | 캐릭터·적 | plan 40/46 |
| 5.5 | 장비 오버레이 | plan 40 |
| 6 | 나무·오브젝트 | plan 42 |
| 6.5 | 모닥불 | plan 36 |
| 7 | 지면 파티클 (먼지·피) | plan 09 |
| 8 | 구조물 상단 (지붕) | plan 31 |
| 9 | 공중 파티클 (슬래시·화살) | plan 46 |
| 10 | 날씨 파티클 | plan 45 |
| 20 | 암흑 레이어 (DarknessLayer) | plan 32 |
| 30 | 이름표·HP바·말풍선 | plan 40/33 |
| 40 | 프로그레스 바 | plan 49 |
| 48 | 날씨 오버레이 (안개·블리자드) | plan 45 |
| 49 | 날씨 유리창 효과 | plan 45 |
| 50 | 화면 전환 오버레이 | plan 44 |
| 60 | 번개 볼트 | plan 45 |
| 70 | 데미지 팝업·XP 팝업 | plan 46/49 |
| 80 | 레벨업 이펙트 | plan 49 |
| 85 | 침략 HUD 화살표 | plan 46 |
| 88 | 빈네트 (상시) | 이번 plan |
| 90 | 피격 빈네트 (빨간) | plan 46 |
| 95 | HUD (게이지·미니맵) | plan 43 |
| 100 | 패널 UI (인벤토리 등) | plan 43 |
| 110 | 토스트 알림 | plan 37 |
| 120 | ESC 메뉴 | plan 37 |
| 130 | 씬 전환 플래시 | plan 44 |

---

## 8. 비주얼 QA 체크리스트 (plan 40~49 통합)

### 캐릭터 (plan 40)
- [ ] 4방향 보행 8fps 애니메이션 정상 재생
- [ ] 이동 중지 시 해당 방향 idle 프레임 즉시 전환
- [ ] 3종 스킨 팔레트 인벤토리·게임 화면 모두 동일
- [ ] 장비 오버레이 방향별 오프셋 정상
- [ ] 피격 플래시 80ms, 광란 빨간 틴트 진동 정상

### 타일 (plan 41)
- [ ] 물 4프레임 yoyo 루프 3fps 정상
- [ ] 암반 autotile 16가지 연결 형태 정상
- [ ] 강변 모래 물 인접 타일 자동 치환 확인
- [ ] 계절 전환 시 흙 틴트 0.5초 lerp 전환
- [ ] 소품 seed 기반 배치 → 멀티 플레이어 동일

### 나무·오브젝트 (plan 42)
- [ ] 4계절 나무 프레임 즉시 전환
- [ ] 벌목 완료 → 쓰러짐 방향 + 낙엽 파티클 25개
- [ ] 10분 후 재생 4단계 트윈 정상 (씨앗→완성)
- [ ] 채굴 균열 3단계 오버레이 진행도 연동

### UI (plan 43)
- [ ] 모든 게이지 위험 구간(≤20%) 깜빡임
- [ ] 슬롯 hover/selected 상태 전환
- [ ] 희귀도 테두리 4색 정상 표시
- [ ] 미니맵 미탐험 검정, 현재 맵 황금 테두리

### 화면 전환 (plan 44)
- [ ] 맵 전환 4방향 슬라이드 + 경계 플래시
- [ ] 수면 눈꺼풀 1초 감김 → 0.8초 뜨임
- [ ] 사망 → 슬로우 → 흑백 → 암전 → 결과 패널
- [ ] 계절 카드 상단 중앙 3초 표시

### 날씨 파티클 (plan 45)
- [ ] 비 빗방울 + 지면 파문 + 유리창 효과
- [ ] 번개 재귀 볼트 15~45초 랜덤 간격
- [ ] 실내 진입 시 모든 파티클 즉시 비표시
- [ ] 날씨 전환 페이드인/아웃 겹침

### 전투 (plan 46)
- [ ] 적 4종 보행·공격·사망 애니메이션
- [ ] 데미지 팝업 크리티컬 스케일 펄스
- [ ] 피격 빈네트 피해량 비례 크기
- [ ] 침략 예고 카운트다운 + 방향 화살표

### 아이템 (plan 47)
- [ ] 34종 아이콘 16×16px 선명 표시
- [ ] 지면 아이템 2초 호버 + 그림자 축소 동기화
- [ ] 희귀 아이템 글로우 깜빡임

### 타이틀 (plan 48)
- [ ] 파노라마 좌→우 0.4px/s 무한 스크롤
- [ ] 시각 기반 하늘 색조 (새벽·낮·저녁·밤)
- [ ] 로고 페이드인 + 황금 반짝임 5개
- [ ] 캐릭터 미리보기 스킨 전환 슬라이드

### 건설·상호작용 (plan 49)
- [ ] 건설 파티클 1초마다 파편 + 완성 팡파레
- [ ] 프로그레스 바 8종 색상·아이콘 정상
- [ ] 지붕 투명화 0.2초 트윈
- [ ] 레벨업 팡파레 링·별·텍스트 전부 정상

### 포스트 FX (이번 plan)
- [ ] 계절별 색조 미세 변화 (여름 채도 높음, 겨울 무채색)
- [ ] 상시 빈네트 가장자리 어두움
- [ ] 카메라 roundPixels = true, 픽셀 흔들림 없음
- [ ] 쉐이크 강도 설정 0 시 완전 비활성

---

## 9. PostFxSystem 클래스

```typescript
export class PostFxSystem {
  private colorGrade:  ColorGradeTransition;
  private vignetteRt:  Phaser.GameObjects.RenderTexture;
  private shakeSystem: ScreenShakeSystem;
  private dynRes:      DynamicResolution;

  constructor(scene: Phaser.Scene) {
    this.colorGrade  = new ColorGradeTransition(scene.cameras.main);
    this.vignetteRt  = createVignetteOverlay(scene);
    this.shakeSystem = new ScreenShakeSystem(scene.cameras.main);
    this.dynRes      = new DynamicResolution(scene.game);
  }

  // 매 프레임
  update(delta: number, ctx: GameContext): void {
    // 색조 그레이딩 타깃 갱신 (초당 1회)
    const target = mergeGrades(
      SEASON_GRADES[ctx.season],
      WEATHER_GRADES[ctx.weather],
      ctx.gameHour,
    );
    this.colorGrade.setTarget(target);
    this.colorGrade.update();

    // 빈네트 강도
    const vAlpha = getVignetteAlpha(ctx);
    this.vignetteRt.setAlpha(vAlpha);

    // 동적 해상도
    this.dynRes.update(ctx.fps);
  }

  // 외부 호출용
  shake(type: ShakeType): void { this.shakeSystem.shake(type); }
  setShakeIntensity(v: number): void { this.shakeSystem.intensity = v; }
}
```

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/PostFxSystem.ts` | 신규: 컬러 그레이딩·빈네트·쉐이크·동적 해상도 통합 |
| `src/rendering/PixelPerfectCamera.ts` | 신규: roundPixels, 정수 스크롤, 경계 클램프 |
| `src/config/postfx.ts` | 신규: SEASON_GRADES, WEATHER_GRADES, SHAKE_CONFIGS 상수 |
| `src/scenes/GameScene.ts` | PostFxSystem 초기화, update 연결 |
| `src/ui/ESCMenu.ts` | 쉐이크 강도 슬라이더 추가 (plan 37 설정 패널 확장) |

---

## 11. 확정 규칙

- 컬러 그레이딩 전환: 5초 lerp (날씨 전환보다 느리게 — 자연스럽게)
- 빈네트: 상시 표시, 강도는 상황별 alpha로만 조절 (ON/OFF 없음)
- 픽셀 퍼펙트: 타일 기반 게임이므로 `roundPixels = true` 필수
- 동적 해상도: 설정에서 OFF 가능 ("고정 품질" 모드)
- 쉐이크 강도 설정값 0: 모든 카메라 진동 완전 차단 (멀미 배려)
- 모바일(plan 38): 컬러 그레이딩 postFX 미지원 기기에서 조용히 스킵
- 야간 블리자드: 채도 최대 -0.65 (weather -0.40 + night -0.15 + winter -0.25 = 클램프 -1 이내)
