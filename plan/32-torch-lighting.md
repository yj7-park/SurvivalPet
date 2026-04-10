# 설계 32 — 횃불 & 야간 조명 시스템

> **전제 조건**: 01~31 단계 완료 상태.
> TimeSystem(plan 08), SpriteGenerator, BuildSystem, Inventory가 구현되어 있다고 가정한다.
> 횃불 제작은 plan 14(제작 숙련도 Lv.1, 목재 ×2)에서 정의됨.

---

## 1. 이번 단계 목표

1. **야간 암흑** — 밤 시간대 화면 어두워짐, 시야 반경 제한
2. **횃불 아이템** — 들고 다니는 광원 (인벤토리 사용)
3. **설치형 횃불** — 지면·벽에 설치 가능한 고정 광원
4. **조명 렌더링** — Phaser RenderTexture 기반 조명 마스크
5. **광원 종류별 밝기** 확정

---

## 2. 야간 암흑 시스템

### 2-1. 시간대별 어두움 레벨

plan 08 게임 시간 기준 (0~86400 게임 내 초):

```typescript
function getDarknessAlpha(gameHour: number): number {
  // gameHour: 0~24 (소수점 포함)
  // 반환값: 0.0(낮) ~ 0.85(완전한 밤) — 알파값이 높을수록 어두움
  if (gameHour >= 6  && gameHour < 8)  return lerp(0.85, 0.0,  (gameHour - 6)  / 2);   // 새벽 밝아짐
  if (gameHour >= 8  && gameHour < 18) return 0.0;   // 낮 (완전 밝음)
  if (gameHour >= 18 && gameHour < 20) return lerp(0.0,  0.55, (gameHour - 18) / 2);   // 저녁 어두워짐
  if (gameHour >= 20 && gameHour < 22) return lerp(0.55, 0.85, (gameHour - 20) / 2);   // 밤 진입
  return 0.85;   // 22:00~06:00 완전한 밤
}
```

### 2-2. 암흑 오버레이 렌더링

Phaser `Graphics` 객체로 화면 전체 어두운 레이어 생성:

```typescript
// 암흑 레이어: 화면 크기 검정 사각형
// 광원 위치에 구멍(빛) 뚫기 → 조명 마스크 방식
class DarknessLayer {
  private rt: Phaser.GameObjects.RenderTexture;

  update(alpha: number, lights: LightSource[]): void {
    if (alpha <= 0) { this.rt.setVisible(false); return; }
    this.rt.setVisible(true);

    // 1. 전체를 어두운 검정으로 채움
    this.rt.clear();
    this.rt.fill(0x000000, alpha);

    // 2. 각 광원 위치에 원형 투명 구멍 그리기 (ERASE 블렌드 모드)
    for (const light of lights) {
      this.drawLightHole(light);
    }
  }

  private drawLightHole(light: LightSource): void {
    // 중심: 불투명 → 가장자리: 투명 (그라디언트 원)
    // Phaser RenderTexture + Graphics erase
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    const r = light.radius;
    // 중심부 완전 투명 (밝음)
    gfx.fillStyle(0x000000, 1.0);
    gfx.fillCircle(light.x, light.y, r * 0.5);
    // 외곽 그라디언트 (4단계 근사)
    for (let i = 1; i <= 4; i++) {
      gfx.fillStyle(0x000000, i * 0.2);
      gfx.fillCircle(light.x, light.y, r * (0.5 + i * 0.125));
    }
    this.rt.erase(gfx, 0, 0);
    gfx.destroy();
  }
}
```

---

## 3. 광원(LightSource) 종류

### 3-1. 광원 정의

```typescript
export interface LightSource {
  id: string;
  x: number; y: number;           // 월드 픽셀 좌표
  radius: number;                 // 빛 반경 (px)
  flicker: boolean;               // 깜빡임 여부
  type: LightType;
}

export type LightType =
  | 'player_torch'    // 플레이어가 들고 있는 횃불
  | 'placed_torch'    // 설치된 횃불
  | 'campfire'        // 모닥불 (추후)
  | 'player_body';    // 플레이어 자체 미광 (달빛 반사 느낌)
```

### 3-2. 광원 반경

| 광원 종류 | 반경(px) | 깜빡임 |
|---------|---------|--------|
| 플레이어 미광 (야간 기본) | 64 | 없음 |
| 들고 있는 횃불 | 160 | 있음 (±8px, 1.5초 주기) |
| 설치된 횃불 | 128 | 있음 (±6px, 2초 주기) |
| 모닥불 (추후) | 200 | 있음 (±12px, 불규칙) |

플레이어 미광: 횃불 없어도 자기 자신 주변 64px는 항상 보임 (완전 암흑 방지).

### 3-3. 깜빡임 구현

```typescript
function flickerRadius(base: number, time: number, amp: number, period: number): number {
  // 사인파 + 약간의 노이즈로 자연스러운 깜빡임
  const noise = (Math.random() - 0.5) * amp * 0.3;
  return base + Math.sin((time / 1000) * (Math.PI * 2 / period)) * amp + noise;
}
```

---

## 4. 횃불 아이템 사용 (인벤토리)

### 4-1. 들고 다니기

```
인벤토리에서 횃불 클릭
  → 컨텍스트 메뉴:
      [🔦 들기]      → 오른손 슬롯에 장착 (무기와 별도 슬롯)
      [🪝 설치하기]  → 현재 위치에 설치형 횃불 배치
      [버리기]

들기 상태:
  → 캐릭터 스프라이트 오른쪽에 횃불 아이콘 표시
  → LightSystem에 'player_torch' 광원 등록 (플레이어 위치 추적)
  → 인벤토리에서 1개 소모 (들고 있는 동안 유지)
```

### 4-2. 횃불 슬롯

장비 패널(E 키, plan 15)에 횃불 슬롯 추가:

```
┌─────────────────────────────────────┐
│ ⚔ 장비                         [✕]  │
├─────────────────────────────────────┤
│  [무기 슬롯]    [방어구 슬롯]        │
│  [방패 슬롯]    [🔦 횃불 슬롯]      │
│                 🔥 횃불             │
├─────────────────────────────────────┤
│  방어도: 5   막기: 15%              │
│  🔦 횃불 장착 중 (야간 시야 +160px) │
└─────────────────────────────────────┘
```

횃불 슬롯:
- 무기 슬롯과 독립 — 무기와 횃불 동시 장착 가능
- 활 사용 시 횃불 자동 해제 없음 (한 손 무기 + 횃불 가능)

### 4-3. 횃불 수명

```typescript
const TORCH_DURATION_MS = 10 * 60 * 1000;   // 현실 10분

interface EquippedTorch {
  remainingMs: number;
}

// 매 프레임 감소
torch.remainingMs -= delta;
if (torch.remainingMs <= 0) {
  // 횃불 소진 → 슬롯 해제, 아이템 소멸
  notifySystem.show('횃불이 꺼졌습니다', 'warning');
  equipmentSystem.unequipTorch();
}

// 30초 전 경고
if (torch.remainingMs <= 30_000 && !warnedOnce) {
  notifySystem.show('횃불이 곧 꺼집니다!', 'warning');
  warnedOnce = true;
}
```

HUD 우상단 횃불 게이지:
```
🔦 [████████░░]  8:24 남음
```

---

## 5. 설치형 횃불

### 5-1. 설치 방법

```
인벤토리 → 횃불 → [설치하기]
  → 건설 시스템과 동일한 배치 UI (투명 프리뷰)
  → 흙 타일에만 설치 가능 (물·암반 불가)
  → 즉시 설치 (건설 시간 없음)
  → 인벤토리에서 1개 소모
```

### 5-2. 설치형 횃불 수명

```typescript
const PLACED_TORCH_DURATION_MS = 20 * 60 * 1000;   // 현실 20분

// 설치 시각 기록, 매 프레임 경과 시간 계산
// 소진 시 스프라이트 제거, SaveData에서 삭제
// 소진 5분 전: 불꽃 크기 50%로 줄어듦 (시각적 경고)
```

### 5-3. SaveData 연동

설치형 횃불은 건설물로 저장:
```typescript
// BuildingSaveEntry 확장
interface TorchSaveEntry extends BuildingSaveEntry {
  type: 'torch_placed';
  placedAt: number;   // Date.now()
  durationMs: number; // 수명
}
```

불러오기 시 `placedAt + durationMs < Date.now()` 이면 이미 소진 → 복원 안 함.

---

## 6. LightSystem 클래스

```typescript
export class LightSystem {
  private lights: Map<string, LightSource>;
  private darknessLayer: DarknessLayer;

  // 광원 등록/해제
  addLight(light: LightSource): void
  removeLight(id: string): void
  updateLight(id: string, x: number, y: number): void  // 플레이어 이동 시

  // 매 프레임
  update(delta: number, gameHour: number): void

  // 현재 어두움 알파 (HUD, 사운드 등 외부 참조용)
  getDarknessAlpha(): number
  isNight(): boolean   // alpha > 0.3
}
```

---

## 7. 야간 게임플레이 영향

### 7-1. 시야 제한

횃불 없는 야간:
- 플레이어 미광(64px) 외 타일은 암흑
- 적 스프라이트: 광원 범위 밖이면 렌더링하되 **어두운 실루엣**으로 표시
  ```typescript
  // 광원 거리 기반 적 스프라이트 틴트
  const dist = distance(player, enemy);
  const lightR = lightSystem.getEffectiveRadius(player.x, player.y);
  if (dist > lightR) {
    enemy.sprite.setTint(0x333333);   // 어두운 실루엣
  } else {
    enemy.sprite.clearTint();
  }
  ```

### 7-2. 야간 적 강화 (plan 06 연동)

밤 시간대(22:00~06:00) 적 침략 빈도 증가는 plan 06에서 설계.  
이번 단계에서 추가: 야간 적 눈이 빛남 (적 스프라이트에 2px 흰 점 추가 — 위협감).

### 7-3. BGM 연동 (plan 26)

`LightSystem.isNight()` → `SoundSystem.setBGMTheme('night')` 트리거 (plan 26 확정).

---

## 8. 스프라이트 추가

SpriteGenerator에 추가:

| 키 | 크기 | 설명 |
|----|------|------|
| `torch_item` | 16×16 | 인벤토리 횃불 아이템 (나무 막대 + 불꽃) |
| `torch_placed` | 16×32 | 설치형 횃불 (지면 꽂힌 모양) |
| `torch_placed_dim` | 16×32 | 소진 임박 (불꽃 작음) |
| `torch_equipped` | 8×16 | 캐릭터 손에 든 횃불 오버레이 |

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/LightSystem.ts` | 신규: 광원 관리·암흑 레이어 제어 |
| `src/ui/DarknessLayer.ts` | 신규: RenderTexture 기반 암흑+조명 마스크 |
| `src/systems/EquipmentSystem.ts` | 횃불 슬롯 추가, 수명 타이머 |
| `src/ui/EquipmentPanel.ts` | 횃불 슬롯 UI 추가 |
| `src/ui/HUD.ts` | 횃불 잔여 시간 게이지 |
| `src/systems/BuildSystem.ts` | 설치형 횃불 배치·소진 처리 |
| `src/scenes/GameScene.ts` | LightSystem 통합, 플레이어 위치 → 광원 갱신 |
| `src/systems/SaveSystem.ts` | `TorchSaveEntry` 직렬화 추가 |
| `src/world/SpriteGenerator.ts` | 횃불 스프라이트 4종 추가 |
| `src/systems/SoundSystem.ts` | `isNight()` 기반 BGM 테마 전환 트리거 |

---

## 10. 확정 규칙

- 낮(08:00~18:00)에는 암흑 레이어 완전 비활성 — 렌더링 비용 0
- 횃불 슬롯 해제 시 아이템은 인벤토리로 반환 (수명 소진 전)
- 설치형 횃불은 다른 플레이어도 철거 가능 (멀티플레이)
- 수명 소진된 횃불은 SaveData에서 자동 제거 (불러오기 시 정리)
- 실내(지붕 아래)에서는 암흑 레이어 적용 안 함 — 지붕 안은 항상 밝음
- 멀티플레이에서 다른 플레이어가 들고 있는 횃불도 광원으로 표시 (로컬 계산)
