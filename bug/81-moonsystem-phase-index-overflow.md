# Bug 81 — MoonSystem: 달 위상 인덱스 8 초과 — 배열 범위 벗어남

## 심각도
낮음

## 파일
`src/rendering/MoonSystem.ts` 라인 ~95

## 현상
`Math.round(phase * 7)` 는 `phase = 1.0` 일 때 8을 반환한다.
달 위상 텍스처 배열이 인덱스 0~7(8개)만 존재할 때
인덱스 8은 `undefined` 를 반환해 텍스처가 적용되지 않거나
콘솔 에러가 발생한다.

## 재현 시나리오
1. 게임 시간을 완전한 보름달 상태로 설정 (phase = 1.0)
2. MoonSystem 업데이트 → `Math.round(1.0 * 7)` = 7.0 → round → 7 (정상)
3. phase = 0.9286... → `Math.round(0.9286 * 7)` = `Math.round(6.5)` = 7 (정상)
4. phase = 0.965 이상 → round = 7 (정상) — 그러나 부동소수점 누적으로 phase > 1.0이 되면 인덱스 = 8

## 원인
```typescript
// MoonSystem.ts ~95
const phaseIndex = Math.round(phase * 7);   // 0~7 의도, 8 가능
this.moonTextures[phaseIndex].draw(...);     // 인덱스 8 → undefined
```

## 수정 방향
```typescript
const phaseIndex = Math.min(7, Math.round(phase * 7));
// 또는: Math.floor(((phase % 1 + 1) % 1) * 8) % 8  (순환 안전 버전)
```
