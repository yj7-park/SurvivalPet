# Bug 84 — ProficiencyPanel: toggle() 빠른 연속 호출 시 isOpen 플래그 불일치

## 심각도
낮음

## 파일
`src/ui/ProficiencyPanel.ts` 라인 ~99-102

## 현상
`toggle()` 가 `isOpen` 플래그를 토글한 뒤 트윈으로 패널을 열거나 닫는다.
트윈이 실행 중(200ms)에 `toggle()` 가 다시 호출되면
`isOpen` 은 이미 반전됐지만 시각적 상태는 아직 이전 방향으로 이동 중이다.
결과적으로 플래그와 실제 표시 상태가 역전된다.

## 재현 시나리오
1. `toggle()` → isOpen = true, 패널 열기 트윈 시작
2. 트윈 완료 전(100ms 후) 다시 `toggle()`
3. isOpen = false, 닫기 트윈 시작 (패널이 아직 열리는 중)
4. 두 트윈 충돌 → 패널이 중간 위치에 고정
5. 이후 `toggle()` 상태 예측 불가

## 원인
```typescript
// ProficiencyPanel.ts ~99
toggle() {
  this.isOpen = !this.isOpen;
  if (this.isOpen) { this.open(); }  // 트윈 비동기
  else             { this.close(); }
  // 트윈 실행 중 재호출 방어 없음
}
```

## 수정 방향
```typescript
toggle() {
  this.scene.tweens.killTweensOf(this.container);
  this.isOpen = !this.isOpen;
  if (this.isOpen) this.open();
  else             this.close();
}
```
