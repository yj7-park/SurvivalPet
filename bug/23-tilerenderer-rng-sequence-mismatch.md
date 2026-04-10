# Bug 23 — TileRenderer: 조건부 RNG 호출로 데코레이션 위치 비결정적

## 심각도
중간

## 파일
`src/rendering/TileRenderer.ts` 라인 ~65-79

## 현상
흙 타일이 아닌 경우 `rng()` 를 1회 호출하고 continue 하는데,
흙 타일인 경우에는 데코레이션 종류에 따라 RNG를 다른 횟수 호출한다.
결과적으로 맵을 재렌더링(씬 재시작, 탭 복귀)할 때 RNG 시퀀스가 달라져
데코레이션(돌, 풀, 꽃 등) 위치가 매번 달라진다.

## 재현 시나리오
1. 게임 시작 → 맵의 데코레이션 위치 확인
2. 게임 재시작 (같은 시드)
3. 데코레이션이 이전과 다른 위치에 배치됨
4. 저장 후 로드 시 맵 외관이 달라짐

## 원인
```typescript
// TileRenderer.ts ~라인 65
if (tiles[ty][tx] !== TileType.Dirt) {
  rng();       // 흙 아니면 1회 소비
  continue;
}
// 흙이면 데코레이션 종류에 따라 1~3회 소비 → 총 호출 횟수 불일치
```

## 수정 방향
타일마다 고정된 횟수(예: 항상 3회)만큼 RNG를 소비하거나,
타일 좌표를 시드로 사용하는 독립적인 로컬 RNG를 사용:
```typescript
const localRng = new SeededRandom(seed ^ (ty * MAP_W + tx));
const roll = localRng.next();
```
