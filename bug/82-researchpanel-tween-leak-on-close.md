# Bug 82 — ResearchPanel: close() 중 트윈 누적 — 빠른 열기/닫기 시 충돌

## 심각도
낮음

## 파일
`src/ui/ResearchPanel.ts` 라인 ~70-81

## 현상
`close()` 에서 container와 dimGfx에 페이드아웃 트윈을 추가하지만
이전에 실행 중인 트윈을 먼저 정지하지 않는다.
패널을 빠르게 열고 닫으면 여러 트윈이 동시에 동일 객체를 조작해
alpha 값이 예측 불가능하게 되고 패널이 완전히 사라지지 않거나
완전히 숨겨지지 않은 상태로 다시 열린다.

## 재현 시나리오
1. 연구 패널 열기 → 페이드인 트윈 시작
2. 페이드인 완료 전 패널 닫기 → 페이드아웃 트윈 추가
3. 두 트윈이 충돌 → alpha 값이 중간에 고정
4. 패널이 반투명 상태로 잔류

## 원인
```typescript
// ResearchPanel.ts ~74
close() {
  // killTweensOf 없이 새 트윈 추가
  this.scene.tweens.add({ targets: this.container, alpha: 0, ... });
  this.scene.tweens.add({ targets: this.dimGfx,   alpha: 0, ... });
}
```

## 수정 방향
```typescript
close() {
  this.scene.tweens.killTweensOf(this.container);
  this.scene.tweens.killTweensOf(this.dimGfx);
  this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 200, ... });
  this.scene.tweens.add({ targets: this.dimGfx,   alpha: 0, duration: 200, ... });
}
```
