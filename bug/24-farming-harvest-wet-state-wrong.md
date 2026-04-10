# Bug 24 — FarmingSystem: 수확 후 마른 농지가 습지로 표시

## 심각도
중간

## 파일
`src/systems/FarmingSystem.ts` 라인 ~230

## 현상
`harvest()` 메서드가 작물을 수확한 뒤 `updateFarmlandSprite(tileX, tileY, true)` 를
항상 `wet=true` 로 호출한다. 수확 시점에 작물이 말라 있었더라도
농지 타일이 습지(짙은 색) 스프라이트로 표시된다.

## 재현 시나리오
1. 작물을 심고 물을 주지 않음 (마른 상태)
2. 작물이 마른 상태에서 완숙 → 수확
3. 수확 후 농지 타일이 습지 색상으로 렌더링됨
4. 플레이어가 이미 물을 줬다고 착각 → 물 주기 생략 → 다음 작물 고사

## 원인
```typescript
// FarmingSystem.ts ~라인 230
harvest(tileX, tileY) {
  const crop = this.getCrop(tileX, tileY);
  // ...수확 처리...
  this.crops.delete(key);
  updateFarmlandSprite(tileX, tileY, true);  // ← 항상 wet=true
}
```

## 수정 방향
수확 전 습지 상태를 확인 후 그대로 유지:
```typescript
harvest(tileX, tileY) {
  const crop = this.getCrop(tileX, tileY);
  const wasWet = crop ? Date.now() < (crop.wetUntil ?? 0) : false;
  // ...수확 처리...
  this.crops.delete(key);
  updateFarmlandSprite(tileX, tileY, wasWet);
}
```
