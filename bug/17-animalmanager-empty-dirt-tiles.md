# Bug 17 — AnimalManager: 흙 타일 없는 맵에서 스폰 시 undefined 접근

## 심각도
중간

## 파일
`src/systems/AnimalManager.ts` 라인 ~43

## 현상
동물 스폰 위치를 결정할 때 `dirtTiles` 배열에서 랜덤 인덱스로 접근하는데,
`dirtTiles`가 비어 있으면 `undefined`를 디스트럭처링하려다 런타임 오류가 발생한다.

## 재현 시나리오
1. 시드 값에 따라 맵이 거의 전부 물·바위 타일로 생성되는 경우
2. `dirtTiles = []` → `dirtTiles[Math.floor(rng.next() * 0)]` → `undefined`
3. `const { x, y } = undefined` → TypeError 크래시

## 원인
```typescript
// AnimalManager.ts ~라인 43
const tile = dirtTiles[Math.floor(rng.next() * dirtTiles.length)];
const { x, y } = tile;   // dirtTiles가 비면 tile === undefined → 크래시
```

## 수정 방향
```typescript
if (dirtTiles.length === 0) {
  console.warn('[AnimalManager] No dirt tiles available for spawning');
  return;
}
const tile = dirtTiles[Math.floor(rng.next() * dirtTiles.length)];
```
