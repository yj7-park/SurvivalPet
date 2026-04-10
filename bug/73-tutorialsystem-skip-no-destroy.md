# Bug 73 — TutorialSystem: skip() 에서 spotlight·arrow destroy 미호출

## 심각도
낮음

## 파일
`src/systems/TutorialSystem.ts` 라인 ~327-330

## 현상
`skip()` 메서드에서 `spotlight?.hide()` 와 `arrow?.hide()` 만 호출하고
객체를 실제로 파괴하지 않는다.
튜토리얼을 건너뛴 뒤 다시 씬이 리로드되면 이전 튜토리얼 객체가
메모리에 남아 있어 중복 렌더링 또는 이벤트 충돌이 발생할 수 있다.

## 재현 시나리오
1. 튜토리얼 진행 중 skip() 호출
2. 게임 재시작 또는 씬 리로드
3. 이전 spotlight/arrow 객체가 파괴되지 않아 씬에 잔류

## 원인
```typescript
// TutorialSystem.ts ~327
skip() {
  this.spotlight?.hide();   // hide만, destroy 미호출
  this.arrow?.hide();
  this.step = 99;
}
```

## 수정 방향
```typescript
skip() {
  this.spotlight?.destroy();
  this.spotlight = null;
  this.arrow?.destroy();
  this.arrow = null;
  // 활성 트윈도 정리
  this.scene.tweens.killAll();  // 또는 특정 트윈 참조 정리
  this.step = 99;
}
```
