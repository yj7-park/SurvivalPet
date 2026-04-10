# Bug 10 — InventoryDragDrop: 드래그 중 tween 중단 로직 없음

## 심각도
낮음

## 파일
`src/ui/InventoryDragDrop.ts`

## 현상
아이템을 드래그 후 슬롯에 드롭하는 snap tween이 실행되는 도중
동일 아이템을 또다시 드래그하면 이전 snap tween이 중단되지 않아
ghost 아이콘이 두 방향으로 동시에 이동하는 시각 오류가 발생한다.

## 재현 시나리오
1. 인벤토리에서 아이템 드래그 시작
2. 슬롯에 빠르게 드롭 (snap tween 시작)
3. snap tween 완료 전에 즉시 동일 슬롯의 아이템을 다시 드래그
4. 두 tween이 동시에 ghost 위치를 업데이트 → 아이콘 떨림/점프

## 원인
```typescript
// InventoryDragDrop.ts ~라인 52, 64, 92
scene.tweens.add({ targets: this.ghostIcon, ... });
// 이전 tween 참조 없음, 중단 불가
```

## 수정 방향
```typescript
private snapTween?: Phaser.Tweens.Tween;

dropOnSlot(slot: SlotInfo) {
  this.snapTween?.stop();
  this.snapTween = scene.tweens.add({
    targets: this.ghostIcon,
    x: slot.x, y: slot.y,
    duration: 100,
    onComplete: () => { this.snapTween = undefined; }
  });
}

startDrag() {
  this.snapTween?.stop();
  this.snapTween = undefined;
  // 드래그 시작 로직
}
```
