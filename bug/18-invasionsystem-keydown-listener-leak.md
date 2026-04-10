# Bug 18 — InvasionSystem: keydown 이벤트 리스너 미제거 메모리 누수

## 심각도
중간

## 파일
`src/systems/InvasionSystem.ts` 라인 ~277

## 현상
침략 이벤트 패널 표시 시 `document.addEventListener('keydown', handleEnter)`를 등록하는데,
패널이 Enter 키가 아닌 다른 방법(ESC, 강제 닫기 등)으로 닫힐 경우
`removeEventListener`가 호출되지 않아 핸들러가 document에 계속 등록된 상태로 남는다.
다음 침략 이벤트에서 또 등록되면 핸들러가 누적되어 Enter 한 번에 여러 번 처리된다.

## 재현 시나리오
1. 침략 이벤트 시작 → 침략 패널 표시
2. ESC 키 또는 다른 방법으로 패널 강제 닫기
3. keydown 리스너가 document에 잔류
4. 다음 침략 이벤트 → 또 리스너 등록 → Enter 시 이전 것 + 새것 모두 실행
5. 침략 이벤트가 두 번 처리됨

## 원인
```typescript
// InvasionSystem.ts ~라인 277
const handleEnter = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    document.removeEventListener('keydown', handleEnter);
    closePanel();
  }
};
document.addEventListener('keydown', handleEnter);
// panel이 Enter 외 방법으로 닫히면 handleEnter 제거 안 됨
```

## 수정 방향
패널 닫힘 경로 모두에서 리스너를 제거하거나, AbortController를 사용:
```typescript
const controller = new AbortController();
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { closePanel(); controller.abort(); }
}, { signal: controller.signal });

// 패널 닫힘 시 항상 호출
function closePanel() {
  controller.abort();  // 자동으로 리스너 제거
  panel.remove();
}
```
