# Bug 44 — VirtualJoystick: dx/dy 이중 계산으로 첫 번째 값 즉시 덮어쓰기

## 심각도
중간

## 파일
`src/ui/VirtualJoystick.ts` 라인 ~61-68

## 현상
`handleTouchMove()` 에서 `state.dx` / `state.dy` 를 두 번 계산한다.
첫 번째 계산(라인 61-62)은 클램핑 전 raw 값을 사용하지만,
두 번째 계산(라인 67-68)에서 즉시 덮어쓴다.
결국 첫 번째 계산은 완전히 무용하며, 의도가 불명확해 유지보수 시
"첫 번째가 의도인가, 두 번째가 버그인가?"를 판단하기 어렵다.

## 재현 시나리오
- 조이스틱 조작 시 실제 입력값에는 영향 없음
- 그러나 미래에 첫 번째 계산을 실제 사용하는 코드가 추가되면 버그로 활성화됨

## 원인
```typescript
// VirtualJoystick.ts ~라인 61-68
this.state.dx = dx / OUTER_RADIUS;         // ← 1차 계산 (클램핑 전)
this.state.dy = dy / OUTER_RADIUS;         // ← 1차 계산 (클램핑 전)
const mag = Math.min(1, dist / OUTER_RADIUS);
this.state.magnitude = mag;
if (dist > 0) {
  this.state.dx = Math.cos(angle) * mag;   // ← 2차 계산으로 즉시 덮어씀
  this.state.dy = Math.sin(angle) * mag;
}
```

## 수정 방향
첫 번째 계산 제거:
```typescript
const mag = Math.min(1, dist / OUTER_RADIUS);
this.state.magnitude = mag;
this.state.dx = dist > 0 ? Math.cos(angle) * mag : 0;
this.state.dy = dist > 0 ? Math.sin(angle) * mag : 0;
```
