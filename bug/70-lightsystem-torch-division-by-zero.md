# Bug 70 — LightSystem: torchDuration = 0 일 때 0 나누기 → Infinity drain

## 심각도
높음

## 파일
`src/systems/LightSystem.ts` 라인 ~88

## 현상
횃불 소모 계산에 `delta / weatherTorchDuration` 이 사용된다.
`weatherTorchDuration` 이 0이면 `Infinity` 가 되어
한 프레임에 횃불이 즉시 완전 소모된다.
날씨/설정 버그로 duration이 0이 된 경우 플레이어 횃불이 불시에 사라진다.

## 재현 시나리오
1. 날씨 시스템 버그 또는 데이터 설정 오류로 torchDuration = 0
2. `torchRemainingMs -= delta / 0` → torchRemainingMs = -Infinity
3. 다음 프레임 횃불 수명 체크 → 즉시 소멸 처리

## 원인
```typescript
// LightSystem.ts ~88
this.torchRemainingMs -= delta * (1 / weatherTorchDuration);
// weatherTorchDuration === 0 → 1/0 = Infinity
```

## 수정 방향
```typescript
const safeD = Math.max(1, weatherTorchDuration);  // 최솟값 1ms 보장
this.torchRemainingMs -= delta / safeD;
```
