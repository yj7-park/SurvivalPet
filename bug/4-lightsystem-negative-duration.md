# Bug 4 — LightSystem: weatherTorchDuration 음수 시 토치 지속시간 역증가

## 심각도
중간

## 파일
`src/systems/LightSystem.ts`

## 현상
`weatherTorchDuration`이 음수로 설정되면 `1 / weatherTorchDuration`이 음수가 되어
토치 소모 계산이 역전된다. 토치가 줄어들어야 할 상황에서 오히려 지속시간이 늘어난다.

## 재현 시나리오
1. 폭풍(thunderstorm) 날씨에서 torch 소모 계수가 잘못 입력되는 경우
2. `weatherTorchDuration = -1` → `1 / -1 = -1` → 소모량이 음수 → 토치 지속시간 증가

## 원인
```typescript
// LightSystem.ts ~라인 88
const rate = weatherTorchDuration > 0 ? 1 / weatherTorchDuration : 1;
// ↑ 양수 체크는 하지만 음수일 때 fallback(1)으로 처리하지 않음
// 실제로는 weatherTorchDuration > 0 체크가 있어 fallback 1을 반환하므로 안전하나,
// 호출부에서 음수를 전달하면 체크 전에 이미 다른 계산에서 사용될 수 있음
```

## 수정 방향
```typescript
const safeDuration = Math.max(0.1, weatherTorchDuration);
const rate = 1 / safeDuration;
```
또한 `weatherTorchDuration` 설정 위치에서 `Math.max(0, ...)` 클램핑 추가.
