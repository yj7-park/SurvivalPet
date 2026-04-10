# Bug 87 — CraftingSystem: 제작 결과 아이템 ID 유효성 미검사

## 심각도
중간

## 파일
`src/systems/CraftingSystem.ts` 라인 ~(craft 완료 섹션)

## 현상
제작 완료 시 레시피의 `resultItem` 을 인벤토리에 추가하기 전에
해당 아이템 ID가 아이템 데이터베이스에 존재하는지 확인하지 않는다.
레시피 데이터 오타나 업데이트 불일치로 `resultItem` 이 유효하지 않은 ID이면
인벤토리에 `undefined` 아이템이 추가되거나 저장 데이터가 오염된다.

## 재현 시나리오
1. 레시피 데이터: `{ resultItem: 'iron_sword_v2' }`
2. 아이템 DB에 'iron_sword_v2' 미존재 (리네임되거나 삭제된 경우)
3. 제작 완료 → `inventory.addItem('iron_sword_v2', 1)`
4. undefined 아이템 인벤토리 슬롯 생성 → 저장 시 데이터 손상

## 원인
```typescript
// CraftingSystem.ts (craft 완료)
const result = recipe.resultItem;
inventory.addItem(result, recipe.resultCount);
// ItemDatabase.has(result) 검사 없음
```

## 수정 방향
```typescript
const result = recipe.resultItem;
if (!ItemDatabase.has(result)) {
  console.error(`[CraftingSystem] 알 수 없는 결과 아이템: ${result}`);
  return;
}
inventory.addItem(result, recipe.resultCount);
```
