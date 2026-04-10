# Bug 6 — FarmingVisualSystem: DryWarningIndicator tween 중복 누적

## 심각도
중간

## 파일
`src/systems/FarmingVisualSystem.ts`

## 현상
`DryWarningIndicator.show(cropKey)`를 동일 cropKey로 여러 번 호출할 때,
이미 실행 중인 yoyo tween이 완료된 직후 재호출하면 새 tween이 추가로 생성된다.
경고 물방울 아이콘이 중복 애니메이션으로 떨리거나 예상보다 빠르게 깜빡인다.

## 재현 시나리오
1. 작물이 말라서 경고 표시 (`show()`)
2. 작물에 물 주기 (`hide()`)
3. 다시 작물이 말라서 `show()` 재호출
4. tween이 완료된 후 타이밍에 따라 새 tween 2개가 동시에 실행됨

## 원인
```typescript
// FarmingVisualSystem.ts ~라인 165-171
show(cropKey: string) {
  if (this.activeWarnings.has(cropKey)) return;  // 중복 방지는 있으나
  // tween 완료 후 activeWarnings에서 제거되면 다음 show()에서 새 tween 생성
  // 이전 tween이 아직 GC 안 된 상태에서 새 tween 시작 가능
  const tween = this.scene.tweens.add({ ..., yoyo: true, repeat: -1 });
  // tween 참조를 Map에 저장하지 않아 hide()에서 중단 불가
}
```

## 수정 방향
```typescript
private warningTweens = new Map<string, Phaser.Tweens.Tween>();

show(cropKey: string) {
  if (this.warningTweens.has(cropKey)) return;
  const tween = this.scene.tweens.add({ ..., yoyo: true, repeat: -1 });
  this.warningTweens.set(cropKey, tween);
}

hide(cropKey: string) {
  this.warningTweens.get(cropKey)?.stop();
  this.warningTweens.delete(cropKey);
  // 아이콘 destroy 처리
}
```
