# Bug 43 — MapTransitionSystem: 고속 이동 시 맵 전환 후 좌표 음수 가능

## 심각도
높음

## 파일
`src/systems/MapTransitionSystem.ts` 라인 ~29-40

## 현상
플레이어가 빠른 속도(순간이동, 높은 AGI)로 맵 경계를 통과하면
다음 맵에서의 진입 좌표 `npx = MAP_PX + px` 계산 결과가 음수가 된다.
음수 좌표로 진입한 플레이어는 즉시 또 다음 맵 전환을 시도하여
무한 맵 전환 루프가 발생하거나 맵 밖 좌표에 갇힌다.

## 재현 시나리오
1. AGI 30 + 이속 버프로 이동속도 400px/s
2. 한 프레임(16ms)에 6.4px 이동 → 맵 경계에서 `px = -6` 정도
3. `npx = 3200 + (-6) = 3194` → 정상
4. 순간이동 버그 발생 시 `px = -500`
5. `npx = 3200 + (-500) = 2700` → 아직 정상이지만
6. 극단적으로 `px = -3500` → `npx = -300` → 음수 좌표 진입
7. 다음 프레임에서 다시 맵 전환 트리거 → 무한 루프

## 원인
```typescript
// MapTransitionSystem.ts ~라인 29-32
if (px < 0) {
  nmx = mapX - 1;
  npx = MAP_PX + px;   // ← px가 -MAP_PX보다 작으면 npx < 0
  exited = true;
}
```

## 수정 방향
```typescript
if (px < 0) {
  if (mapX === 0) { this.triggerEdgeBlock(); return false; }
  nmx = mapX - 1;
  npx = Math.max(0, MAP_PX + px);    // 0 이하로 내려가지 않도록 클램핑
  exited = true;
} else if (px >= MAP_PX) {
  if (mapX === MAP_COUNT_W - 1) { this.triggerEdgeBlock(); return false; }
  nmx = mapX + 1;
  npx = Math.min(MAP_PX - 1, px - MAP_PX);  // MAP_PX 이상으로 올라가지 않도록
  exited = true;
}
// Y축도 동일하게 처리
```
