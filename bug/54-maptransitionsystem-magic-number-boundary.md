# Bug 54 — MapTransitionSystem: 맵 경계 검사 하드코딩 상수 — 맵 크기 변경 시 무효

## 심각도
낮음

## 파일
`src/systems/MapTransitionSystem.ts` 라인 ~31

## 현상
맵 경계 체크가 `mapX === 9` 와 같이 하드코딩된 숫자를 사용한다.
게임 맵 그리드가 10×10에서 변경될 경우 경계 검사가 자동으로 갱신되지 않아
플레이어가 맵 외부 좌표로 이동하거나 전환이 미발동될 수 있다.

## 재현 시나리오
1. MAP_WIDTH 를 12로 변경
2. `mapX === 9` 조건이 여전히 10번째 열에서 전환 시도
3. 11번째·12번째 열은 전환 불가 → 맵 벽에 끼임

## 원인
```typescript
// MapTransitionSystem.ts ~31
if (mapX === 9) { triggerTransition('right'); }   // 하드코딩
```

## 수정 방향
```typescript
const MAP_WIDTH  = MAP_CONFIG.width  ?? 10;
const MAP_HEIGHT = MAP_CONFIG.height ?? 10;

if (mapX >= MAP_WIDTH - 1)  { triggerTransition('right'); }
if (mapX <= 0)               { triggerTransition('left'); }
if (mapY >= MAP_HEIGHT - 1)  { triggerTransition('down'); }
if (mapY <= 0)               { triggerTransition('up'); }
```
