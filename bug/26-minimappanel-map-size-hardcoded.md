# Bug 26 — MiniMapPanel: 맵 크기 10×10 하드코딩

## 심각도
중간

## 파일
`src/ui/MiniMapPanel.ts` 라인 ~62-75

## 현상
멀티맵 렌더링 루프가 `for (let my = 0; my < 10; my++)` 로 10×10으로 하드코딩되어 있다.
실제 게임 세계 맵 크기가 변경되거나 방문 가능한 맵 수가 달라지면
미니맵이 잘못된 범위를 그리거나 배열 범위를 벗어난다.

## 재현 시나리오
1. 게임 세계를 15×15 맵으로 확장 시
2. 미니맵은 여전히 10×10만 표시
3. 오른쪽/아래쪽 맵 5칸은 미니맵에 표시되지 않음
4. 반대로 5×5 맵으로 줄이면 없는 맵 영역을 렌더링 시도 → 배열 undefined 접근

## 원인
```typescript
// MiniMapPanel.ts ~라인 62-75
for (let my = 0; my < 10; my++) {
  for (let mx = 0; mx < 10; mx++) {
    // ← 10이 하드코딩, MAP_COUNT_W/H 상수 미사용
  }
}
```

## 수정 방향
```typescript
import { MAP_COUNT_W, MAP_COUNT_H } from '../world/MapGenerator';

for (let my = 0; my < MAP_COUNT_H; my++) {
  for (let mx = 0; mx < MAP_COUNT_W; mx++) {
    // 상수 기반으로 변경
  }
}
```
