# Bug 85 — FarmingVisualSystem: onHarvestReady 트윈 미정지 후 스프라이트 재사용

## 심각도
낮음

## 파일
`src/rendering/FarmingVisualSystem.ts` 라인 ~119-131

## 현상
`onHarvestReady()` 에서 수확 준비 강조 트윈을 추가하지만
이전 성장 단계(`onStageAdvance()`)에서 추가된 트윈을 정지하지 않는다.
같은 스프라이트에 여러 트윈이 겹치면 `angle` 이나 `scaleX` 가
충돌하며 작물 스프라이트가 예상치 않게 회전하거나 깜빡인다.

## 재현 시나리오
1. 작물 성장 단계 진행 → 각 단계에서 bounce 트윈 추가
2. 마지막 단계 도달 → `onHarvestReady()` 호출 시 이전 트윈 활성
3. 두 트윈이 scaleX 동시 조작 → 스프라이트 크기 난동

## 원인
```typescript
// FarmingVisualSystem.ts ~122
onHarvestReady(sprite) {
  // 기존 트윈 정지 없이 새 트윈 추가
  scene.tweens.add({ targets: sprite, scaleX: 1.15, scaleY: 1.15, yoyo: true, repeat: -1, ... });
}
```

## 수정 방향
```typescript
onHarvestReady(sprite) {
  scene.tweens.killTweensOf(sprite);
  sprite.setScale(1);  // 스케일 초기화
  scene.tweens.add({ targets: sprite, scaleX: 1.15, scaleY: 1.15, yoyo: true, repeat: -1, ... });
}
```
