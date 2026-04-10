# Bug 49 — InvasionSystem: showInvasionPanel setInterval 미해제 메모리 누수

## 심각도
중간

## 파일
`src/systems/InvasionSystem.ts` 라인 ~256-261

## 현상
`showInvasionPanel()` 내부에서 카운트다운용 `setInterval`을 생성하지만
반환된 ID를 저장하지 않는다.
패널이 버튼 클릭으로 닫히면 인터벌이 계속 동작하며
이미 제거된 DOM 요소에 접근해 콘솔 에러가 발생한다.

## 재현 시나리오
1. 침략 이벤트 시작 → 카운트다운 패널 표시
2. 카운트다운 종료 전에 버튼으로 패널 닫기
3. setInterval 콜백이 제거된 DOM에 계속 접근

## 원인
```typescript
// InvasionSystem.ts ~256
setInterval(() => {
  remaining--;
  countdownEl.textContent = `${remaining}s`;   // DOM 이미 제거됨
  if (remaining <= 0) { ... }
}, 1000);
// ID를 변수에 저장하지 않아 clearInterval 불가
```

## 수정 방향
```typescript
private _invasionTimer: ReturnType<typeof setInterval> | null = null;

showInvasionPanel() {
  this._invasionTimer = setInterval(() => { ... }, 1000);
}

closeInvasionPanel() {
  if (this._invasionTimer) { clearInterval(this._invasionTimer); this._invasionTimer = null; }
  // DOM 제거
}
```
