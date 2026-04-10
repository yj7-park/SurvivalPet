# Bug 57 — SleepSystem: 기상 조건 strict equality — 게임 시간 부동소수점 오차로 미기상

## 심각도
중간

## 파일
`src/systems/SleepSystem.ts` 라인 ~(wakeup 체크 섹션)

## 현상
수면 종료 시각을 `gameTime === wakeTime` 으로 비교한다.
게임 시간이 float 덧셈으로 누적되면 부동소수점 오차로
`wakeTime`을 정확히 통과하지 못해 플레이어가 영구적으로 수면 상태에 빠진다.
(기존 bug/21과 유사하나 다른 코드 경로에서 동일 패턴 반복)

## 재현 시나리오
1. 수면 중 wakeTime = 6.00
2. delta 누적: 5.9998 → 6.0003 (6.0000 건너뜀)
3. `gameTime === 6.00` 조건 불만족 → 기상 미실행

## 원인
```typescript
// SleepSystem.ts
if (this.gameTime === this.wakeTime) {
  this.wake();
}
```

## 수정 방향
```typescript
// 같거나 지났으면 기상
if (this.sleeping && this.gameTime >= this.wakeTime) {
  this.wake();
}
```
