# Bug 51 — InvasionSystem: 이벤트 트리거 조건 부동소수점 비교로 누락 가능

## 심각도
중간

## 파일
`src/systems/InvasionSystem.ts` 라인 ~179-182

## 현상
이벤트 발생 조건을 `Math.abs(now - evt.time) < 0.001` 로 검사한다.
프레임 드롭이나 탭 전환으로 인해 `update()`가 늦게 호출되면
`now`가 `evt.time + 0.001` 이상을 건너뛰어 이벤트가 영구 미발동된다.

## 재현 시나리오
1. 침략 이벤트 예약 시각 = 100.0000
2. 탭 전환 → 브라우저가 `requestAnimationFrame` 스로틀
3. 다음 `update()` 호출 시 `now = 100.05` → 차이 0.05 > 0.001
4. 이벤트 미발동, 침략이 시작되지 않음

## 원인
```typescript
// InvasionSystem.ts ~179
if (Math.abs(now - evt.time) < 0.001) {
  triggerInvasion(evt);
}
```
부동소수점 창이 너무 좁아 프레임 드롭 시 창을 지나침.

## 수정 방향
```typescript
// 시간 범위 검사: 이미 지났으며 아직 트리거 안 됨
if (now >= evt.time && !evt.triggered) {
  evt.triggered = true;
  triggerInvasion(evt);
}
```
