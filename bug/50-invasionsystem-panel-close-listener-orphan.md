# Bug 50 — InvasionSystem: 패널 버튼 닫기 시 keydown 리스너 미제거

## 심각도
중간

## 파일
`src/systems/InvasionSystem.ts` 라인 ~270-277

## 현상
`showInvasionPanel()`은 Enter 키로 패널을 닫으려고 `keydown` 리스너를 등록한다.
해당 리스너는 Enter 키가 눌릴 때만 자기 자신을 제거한다.
하지만 패널이 버튼 클릭으로 먼저 닫히면 리스너가 document에 계속 남아
이후 다른 Enter 입력에 반응해 `closeInvasionPanel()`을 이중 호출할 수 있다.

## 재현 시나리오
1. 침략 패널 표시
2. Enter 대신 닫기 버튼으로 패널 닫기
3. 이후 Enter 입력 → `closeInvasionPanel()` 재호출 (이미 제거된 패널에 접근)

## 원인
```typescript
const handleEnter = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    document.removeEventListener('keydown', handleEnter);  // Enter 시에만 제거
    closeInvasionPanel();
  }
};
document.addEventListener('keydown', handleEnter);
// closeInvasionPanel() 버튼 경로에서는 removeEventListener 없음
```

## 수정 방향
```typescript
// closeInvasionPanel() 내에서도 반드시 제거
closeInvasionPanel() {
  document.removeEventListener('keydown', this._enterHandler);
  // ... DOM 제거
}
```
