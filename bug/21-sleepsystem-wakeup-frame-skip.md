# Bug 21 — SleepSystem: 기상 시각(6:00) 프레임 드롭 시 건너뜀

## 심각도
높음

## 파일
`src/systems/SleepSystem.ts` 라인 ~74

## 현상
수면 중 기상 조건이 `hour === 6 && minute === 0` 완전 일치로만 작동한다.
게임 시간이 빠르게 진행되거나 프레임 드롭이 있을 때 5:59 → 6:01로 점프하면
6:00 정각을 건너뛰어 플레이어가 영원히 잠든 상태로 남는다.

## 재현 시나리오
1. 침대에서 수면 시작
2. 브라우저 탭 전환 등으로 30초 이상 게임이 멈췄다가 재개 (큰 delta 발생)
3. 게임 시간이 5:59에서 6:05로 점프
4. 기상 조건 불충족 → 무한 수면 상태

## 원인
```typescript
// SleepSystem.ts ~라인 74
if (gameTime.hour === 6 && gameTime.minute === 0) {
  this.wakeUp();
}
// 정각이 아닌 6:01 이후는 조건 미충족
```

## 수정 방향
```typescript
// 6:00 이후면 기상 (범위 비교)
const totalMinutes = gameTime.hour * 60 + gameTime.minute;
if (totalMinutes >= 6 * 60 && totalMinutes < 22 * 60) {
  this.wakeUp();
}
```
