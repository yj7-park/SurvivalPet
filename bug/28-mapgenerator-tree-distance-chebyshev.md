# Bug 28 — MapGenerator: 나무 최소 거리 체크가 체비쇼프 거리로 예상보다 조밀

## 심각도
낮음

## 파일
`src/world/MapGenerator.ts` 라인 ~202

## 현상
`placeTrees()` 에서 나무 간 최소 거리를 `minDist = 2` 로 체크할 때
`Math.abs(px - cx) < minDist && Math.abs(py - cy) < minDist` (체비쇼프 거리)를 사용한다.
유클리드 거리 2를 기대했다면 실제로는 대각선 방향으로 거리 √2 ≈ 1.41 간격의
나무가 배치 가능해 나무가 예상보다 촘촘하게 심어진다.

## 재현 시나리오
1. 아무 시드로 게임 시작
2. 나무 숲 구역을 확인하면 대각선 방향으로 나무가 붙어있는 경우 발생
3. 플레이어가 나무 사이를 이동할 수 없는 경우 생김

## 원인
```typescript
// MapGenerator.ts ~라인 202
const tooClose = trees.some(([cx, cy]) =>
  Math.abs(px - cx) < minDist && Math.abs(py - cy) < minDist
);
// 체비쇼프 거리: 정사각형 범위 체크 → 대각선이 더 가까이 배치 가능
```

## 수정 방향
유클리드 거리 또는 맨해튼 거리로 변경:
```typescript
const tooClose = trees.some(([cx, cy]) => {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy < minDist * minDist;  // 유클리드 거리²
});
```
