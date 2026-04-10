# Bug 52 — CampfireSystem: closeDangerUI 호출 시 진행 중 트윈이 파괴된 객체 접근

## 심각도
중간

## 파일
`src/systems/CampfireSystem.ts` 라인 ~318-344

## 현상
`showDangerUI()`는 `dangerOverlay`·`dangerText`에 트윈을 추가한다.
`closeDangerUI()`는 트윈을 정지하지 않고 객체를 곧바로 `destroy()`한다.
진행 중인 트윈이 다음 프레임에 이미 파괴된 GameObjects에 접근해
Phaser 내부 에러가 발생한다.

## 재현 시나리오
1. 화롯불 위험 UI 표시 (트윈 시작)
2. 즉시 화롯불 소화 → `closeDangerUI()` 호출
3. 트윈 onUpdate 콜백이 `dangerOverlay.setAlpha(...)` 에 접근 → 에러

## 원인
```typescript
// CampfireSystem.ts ~340
closeDangerUI() {
  this.dangerOverlay.destroy();   // 트윈 미정지 상태로 파괴
  this.dangerText.destroy();
}
```

## 수정 방향
```typescript
closeDangerUI() {
  this.scene.tweens.killTweensOf(this.dangerOverlay);
  this.scene.tweens.killTweensOf(this.dangerText);
  this.dangerOverlay.destroy();
  this.dangerText.destroy();
}
```
