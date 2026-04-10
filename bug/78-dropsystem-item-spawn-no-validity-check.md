# Bug 78 — DropSystem: 아이템 스폰 시 타일 유효성 미검사 — 벽 내부 드롭

## 심각도
중간

## 파일
`src/systems/DropSystem.ts` 라인 ~(spawnDrop 섹션)

## 현상
`spawnDrop(itemKey, x, y)` 가 타일 유효성을 검사하지 않고
전달된 좌표에 그대로 아이템을 생성한다.
몬스터가 벽 안에서 사망하거나 건물 내부 타일에서 드롭이 발생하면
플레이어가 접근할 수 없는 위치에 아이템이 생성되어 영구 분실된다.

## 재현 시나리오
1. 벽 근처 몬스터 처치
2. 몬스터 사망 위치가 벽 타일 내부로 판정
3. `spawnDrop()` 호출 → 벽 타일 좌표에 아이템 생성
4. 플레이어가 해당 위치 접근 불가 → 아이템 영구 분실

## 원인
```typescript
// DropSystem.ts (spawnDrop)
spawnDrop(itemKey: string, x: number, y: number) {
  this.groundItems.push({ itemKey, x, y, ... });
  // 타일 종류 (벽/물/건물) 검사 없음
}
```

## 수정 방향
```typescript
spawnDrop(itemKey: string, x: number, y: number) {
  // 유효 타일인지 확인, 아니면 인접 빈 타일로 오프셋
  const safePos = this.findNearestWalkable(x, y);
  this.groundItems.push({ itemKey, x: safePos.x, y: safePos.y, ... });
}

private findNearestWalkable(x: number, y: number): { x: number; y: number } {
  if (this.tileMap.isWalkable(x, y)) return { x, y };
  // 8방향 인접 타일에서 walkable 탐색
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],...]) {
    if (this.tileMap.isWalkable(x + dx * 32, y + dy * 32)) {
      return { x: x + dx * 32, y: y + dy * 32 };
    }
  }
  return { x, y };  // fallback
}
```
