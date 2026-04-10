# Bug 42 — ResearchSystem: 연구 취소 시 소비 재료 미반환

## 심각도
높음

## 파일
`src/systems/ResearchSystem.ts` 라인 ~56-70

## 현상
`startResearch()` 에서 연구 재료를 인벤토리에서 **즉시 제거**하지만,
`cancelResearch()` 에서 아무것도 반환하지 않는다.
플레이어가 의도치 않게 취소하거나 게임이 크래시되면
연구 재료가 영구적으로 소멸한다.

## 재현 시나리오
1. "석재 벽 연구" 시작 → 가공 석재 5개 즉시 인벤토리에서 제거
2. 연구 진행 중 취소 버튼 클릭 (`cancelResearch()` 호출)
3. 가공 석재 5개가 돌아오지 않음
4. 희귀 재료가 필요한 연구일 경우 회복 불가능한 손실

## 원인
```typescript
// ResearchSystem.ts ~라인 56-70
startResearch(def, inventory) {
  for (const i of def.inputs) {
    inventory.remove(i.itemId, i.amount);  // 즉시 제거
  }
  this.current = { def, startedAt: Date.now() };
  return true;
}

cancelResearch() {
  this.current = null;   // 재료 반환 없이 상태만 초기화
  this.elapsed = 0;
}
```

## 수정 방향
```typescript
cancelResearch(inventory: Inventory): void {
  if (this.current) {
    for (const input of this.current.def.inputs) {
      inventory.add(input.itemId, input.amount);  // 재료 전량 반환
    }
  }
  this.current = null;
  this.elapsed = 0;
}
```
단, 게임 로드 시 `current` 가 복구될 경우 인벤토리에서 재료가 이미 없음을 고려해야 함.
