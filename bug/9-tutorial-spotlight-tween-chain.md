# Bug 9 — TutorialSpotlight: moveTo tween 체인 추적 불가 / double-destroy

## 심각도
낮음

## 파일
`src/ui/TutorialSpotlight.ts`

## 현상
`moveTo()` 호출 시 tween의 `onComplete` 콜백 내에서 새 tween을 생성하는 체인 구조인데,
중간 tween의 참조를 저장하지 않는다. 튜토리얼 강제 스킵(skip) 시 이미 진행 중인
이동 tween을 중단할 수 없어 spotlight이 의도치 않은 위치로 이동 후 정지한다.

추가로 `destroy()` 시 `borderGfx`가 이미 파괴된 상태일 경우 재호출 시 에러 발생 가능.

## 재현 시나리오
1. 튜토리얼 중 spotlight이 여러 번 moveTo() 호출
2. 중간에 튜토리얼 스킵
3. destroy() 실행되지만 이전 tween이 남아서 이미 destroy된 Graphics를 이동시키려 함

## 원인
```typescript
// TutorialSpotlight.ts ~라인 73-79
moveTo(x: number, y: number) {
  scene.tweens.add({   // 참조 저장 없음
    targets: this.container,
    x, y,
    duration: 300,
    onComplete: () => {
      scene.tweens.add({ ... });  // 체인 tween도 참조 없음
    }
  });
}
```

## 수정 방향
```typescript
private moveTween?: Phaser.Tweens.Tween;

moveTo(x: number, y: number) {
  this.moveTween?.stop();
  this.moveTween = scene.tweens.add({ targets: this.container, x, y, duration: 300 });
}

destroy() {
  this.moveTween?.stop();
  this.borderGfx?.destroy();
  this.borderGfx = undefined;
}
```
