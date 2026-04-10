# 설계 26 — 사운드 시스템

> **전제 조건**: 01~25 단계 완료 상태.
> 모든 게임 시스템이 구현되어 있다고 가정한다.
> 외부 오디오 파일 없음 — 모든 사운드는 **Web Audio API로 코드 생성**.

---

## 1. 이번 단계 목표

1. **Web Audio API 기반 사운드 생성** — 외부 파일 없이 절차적 사운드
2. **효과음(SFX)** — 게임 이벤트별 사운드 정의
3. **배경음악(BGM)** — 시간대·상황별 절차적 음악
4. **사운드 믹서** — 볼륨 채널 분리 (마스터·SFX·BGM)
5. **설정 패널 연동** — plan 19 설정에 볼륨 슬라이더 추가

---

## 2. Web Audio API 사운드 생성 원칙

외부 `.mp3` / `.wav` 파일 없이 `AudioContext`로 직접 합성:

```typescript
// SoundGenerator: 모든 사운드를 AudioBuffer로 생성
export class SoundGenerator {
  private ctx: AudioContext;

  // 기본 파형 생성 헬퍼
  private createTone(
    freq: number, duration: number,
    type: OscillatorType,
    envelope: { attack: number; decay: number; sustain: number; release: number }
  ): AudioBuffer

  // 노이즈 생성 (타격음, 자연음 등)
  private createNoise(duration: number, color: 'white' | 'pink'): AudioBuffer

  // 피치 슬라이드 (sweep)
  private createSweep(freqStart: number, freqEnd: number, duration: number): AudioBuffer
}
```

---

## 3. 효과음(SFX) 목록

### 3-1. 상호작용 사운드

| 이벤트 | 사운드 설명 | 생성 방법 |
|--------|-----------|---------|
| 벌목 타격 | 둔탁한 나무 충격음 | 핑크 노이즈 버스트 (0.15초) + 저역 강조 (200Hz) |
| 벌목 완료 | 나무 쓰러지는 소리 | 노이즈 크레센도 → 디크레센도 (0.8초) |
| 채굴 타격 | 금속성 돌 충격 | 화이트 노이즈 (0.1초) + 고역 (2kHz) |
| 채굴 완료 | 암석 부서지는 소리 | 노이즈 버스트 × 3회 빠른 연속 |
| 낚시 시작 | 릴 풀리는 소리 | 200→100Hz sweep (0.3초) |
| 낚시 성공 | 물 튀기는 소리 | 핑크 노이즈 (0.2초) + 고역 강조 |
| 낚시 실패 | 짧은 낮은 음 | 300Hz 삼각파 (0.2초) 페이드아웃 |

### 3-2. 전투 사운드

| 이벤트 | 사운드 설명 | 생성 방법 |
|--------|-----------|---------|
| 근접 공격 | 바람 가르는 소리 | 800→200Hz sweep 노이즈 (0.12초) |
| 활 발사 | 현 튕기는 소리 | 400Hz 삼각파 (0.08초) + 빠른 릴리즈 |
| 화살 피격 | 두탁한 타격음 | 노이즈 버스트 (0.1초) |
| 막기(Block) 성공 | 금속 충격음 | 1200Hz 사인파 (0.15초) + 빠른 decay |
| 적 처치 | 짧은 승리음 | 440→660Hz sweep 사인파 (0.3초) |
| 플레이어 피격 | 육중한 타격음 | 핑크 노이즈 (0.2초) + 100Hz 부스트 |
| 플레이어 사망 | 무거운 하강음 | 300→80Hz sweep (1.2초) 페이드아웃 |

### 3-3. UI / 시스템 사운드

| 이벤트 | 사운드 설명 | 생성 방법 |
|--------|-----------|---------|
| 버튼 클릭 | 짧고 밝은 클릭 | 800Hz 사인파 (0.05초) |
| 인벤토리 열기/닫기 | 종이 넘기는 소리 | 화이트 노이즈 (0.08초) 피치업 |
| 아이템 획득 | 짧은 상승음 | 440→660Hz (0.15초) |
| 레벨업 | 밝은 3화음 아르페지오 | 523→659→784Hz 순차 (각 0.15초) |
| 건설 완료 | 안정감 있는 두드림 | 200Hz 사인파 × 2회 (0.1초 간격) |
| 광란 진입 | 불안한 저음 | 80Hz 톱니파 + 비브라토 (1초) |
| 광란 종료 | 안도의 상승음 | 300→500Hz 사인파 (0.5초) |
| 수면 시작 | 나른한 하강음 | 440→220Hz 사인파 (1초) |
| 기상 | 밝은 아침 벨 | 880Hz 사인파 (0.3초) 페이드인 |
| 경고 알림 | 두 번 삐 | 600Hz × 2회 (각 0.12초, 0.1초 간격) |

### 3-4. 건축 사운드

| 이벤트 | 사운드 |
|--------|--------|
| 건설 타격 (프로그레스) | 망치질: 노이즈 버스트 0.1초 × 주기적 |
| 철거 타격 | 금속 마찰음: sweep 노이즈 |
| 구조물 파괴 | 붕괴음: 노이즈 크레센도 → 잔향 (0.6초) |

---

## 4. 배경음악(BGM) — 절차적 생성

### 4-1. 시간대별 BGM 테마

| 시간대 | 분위기 | 음악 특성 |
|--------|--------|---------|
| 새벽 (00:00~06:00) | 고요, 신비 | 저음 드론 + 간헐적 고음 핑 |
| 아침 (06:00~12:00) | 활기, 희망 | C장조 아르페지오, 중간 템포 |
| 낮 (12:00~18:00) | 평온, 집중 | 반복 미니멀 패턴, 밝은 톤 |
| 저녁 (18:00~22:00) | 긴장, 경계 | 단조 진행, 템포 약간 빠름 |
| 밤 (22:00~24:00) | 위험, 공포 | 불규칙 드럼 + 저음 불협화음 |

### 4-2. 상황별 BGM 오버라이드

| 상황 | BGM 변화 |
|------|---------|
| 적 침략 감지 | 긴장 테마로 크로스페이드 (2초) |
| 광란 모드 | 혼돈 테마 (빠른 불규칙 리듬) |
| 수면 중 | BGM 볼륨 → 0 (무음) |
| 사망 | BGM 즉시 페이드아웃 |
| 타이틀 화면 | 잔잔한 앰비언트 루프 |

### 4-3. BGM 생성 구조

```typescript
export class BGMGenerator {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private currentTheme: BGMTheme | null = null;

  // 테마 전환 (크로스페이드)
  switchTheme(theme: BGMTheme, fadeMs: number = 2000): void

  // 절차적 멜로디 생성 (스케일 기반)
  private scheduleMelody(scale: number[], bpm: number, bars: number): void

  // 드론(지속음) 레이어
  private playDrone(freq: number, durationMs: number): void

  // 퍼커션 레이어 (노이즈 기반)
  private schedulePercussion(pattern: boolean[], bpm: number): void
}

type BGMTheme = 'dawn' | 'morning' | 'day' | 'evening' | 'night'
              | 'invasion' | 'frenzy' | 'title';
```

### 4-4. 스케일 정의

```typescript
const SCALES = {
  // 아침: C 메이저 펜타토닉
  morning: [261.63, 293.66, 329.63, 392.00, 440.00],
  // 저녁: A 마이너
  evening: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00],
  // 밤/침략: B 로크리안 (불안한 음계)
  night:   [246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 415.30],
  // 광란: 반음 클러스터 (무조성)
  frenzy:  [220.00, 233.08, 246.94, 261.63, 277.18],
};
```

---

## 5. SoundSystem 클래스

```typescript
export class SoundSystem {
  private ctx: AudioContext;
  private generator: SoundGenerator;
  private bgm: BGMGenerator;

  // 볼륨 채널
  private masterGain: GainNode;   // 전체
  private sfxGain: GainNode;      // 효과음
  private bgmGain: GainNode;      // 배경음악

  // SFX 재생
  play(id: SoundId, options?: { volume?: number; pitch?: number }): void

  // BGM 제어
  setBGMTheme(theme: BGMTheme, fadeMs?: number): void
  updateBGMByGameTime(gameHour: number, situation: GameSituation): void

  // 볼륨 조절
  setMasterVolume(v: number): void    // 0.0~1.0
  setSFXVolume(v: number): void
  setBGMVolume(v: number): void

  // AudioContext 초기화 (브라우저 정책: 사용자 제스처 후 호출)
  init(): Promise<void>
  isReady(): boolean
}

type SoundId =
  | 'woodcut_hit' | 'woodcut_done' | 'mine_hit' | 'mine_done'
  | 'fish_start' | 'fish_success' | 'fish_fail'
  | 'attack_melee' | 'attack_bow' | 'hit_arrow' | 'block'
  | 'enemy_die' | 'player_hit' | 'player_die'
  | 'btn_click' | 'inv_open' | 'item_pickup' | 'levelup'
  | 'build_done' | 'build_destroy' | 'frenzy_start' | 'frenzy_end'
  | 'sleep_start' | 'wake_up' | 'alert';

type GameSituation = 'normal' | 'invasion' | 'frenzy';
```

---

## 6. 오디오 초기화 전략

브라우저 정책상 `AudioContext`는 사용자 제스처 없이 시작 불가:

```typescript
// TitleScene 첫 버튼 클릭 시 초기화
titleButton.on('pointerdown', async () => {
  await soundSystem.init();
  // 이후 모든 사운드 사용 가능
});

// 초기화 전 play() 호출 시 조용히 무시 (에러 없음)
play(id: SoundId): void {
  if (!this.isReady()) return;
  // ...
}
```

---

## 7. 설정 패널 연동 (plan 19 확장)

```
┌──────────────────────────────────────────┐
│  설정                              [✕]   │
├──────────────────────────────────────────┤
│  ── 사운드 ─────────────────────────── │
│  마스터 볼륨   [────●──────────]  60%   │
│  효과음        [──────●────────]  80%   │
│  배경음악      [────●──────────]  40%   │
│                                          │
│  ── 표시 ──────────────────────────── │
│  ...                                     │
└──────────────────────────────────────────┘
```

볼륨은 `sv_settings` localStorage에 저장 (plan 17).

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/SoundSystem.ts` | 신규: 사운드 재생·볼륨 관리 |
| `src/systems/SoundGenerator.ts` | 신규: Web Audio API 사운드 합성 |
| `src/systems/BGMGenerator.ts` | 신규: 절차적 배경음악 생성 |
| `src/scenes/GameScene.ts` | SoundSystem 연동, 게임 시간→BGM 테마 갱신 |
| `src/scenes/TitleScene.ts` | AudioContext 초기화, 타이틀 BGM |
| `src/ui/SettingsPanel.ts` | 볼륨 슬라이더 3개 추가 |
| `src/systems/CombatSystem.ts` | 전투 SFX 호출 |
| `src/systems/BuildSystem.ts` | 건설 SFX 호출 |
| `src/systems/ActionSystem.ts` | 광란 SFX 호출 |
| `src/systems/SleepSystem.ts` | 수면/기상 SFX 호출 |

---

## 9. 확정 규칙

- 모든 사운드는 Web Audio API 절차적 생성 — 외부 파일 의존성 0
- `AudioContext` 미초기화 상태에서 `play()` 호출 시 무시 (에러 없음)
- BGM은 루프 구조 — 마디 단위로 반복 스케줄링 (`AudioContext.currentTime` 기준)
- 탭 비활성화(visibilitychange) 시 마스터 볼륨 0으로 뮤트, 복귀 시 복원
- 동일 SFX 최대 동시 재생 수: 4개 (초과 시 가장 오래된 것 중단)
- 피치 변형 옵션(`pitch` 파라미터)으로 같은 사운드를 약간씩 다르게 재생해 반복감 감소
