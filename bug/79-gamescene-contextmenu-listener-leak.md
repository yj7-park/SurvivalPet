# Bug 79 — GameScene: 컨텍스트 메뉴 외부 클릭 리스너 누적

## 심각도
중간

## 파일
`src/scenes/GameScene.ts` 라인 ~2455-2461, 2569-2571

## 현상
컨텍스트 메뉴가 열릴 때 `document` 에 `mousedown` 이벤트 리스너를
등록하지만 `closeContextMenu()` 에서 DOM 요소만 제거하고
리스너를 `removeEventListener` 하지 않는다.
메뉴를 자주 열고 닫으면 리스너가 누적되어 닫힌 메뉴에 대한
콜백이 계속 실행된다.

## 재현 시나리오
1. 오브젝트 우클릭 → 컨텍스트 메뉴 열기 (리스너 등록)
2. 메뉴 닫기 → 리스너 미제거
3. 10회 반복 → 10개 리스너 쌓임
4. 화면 클릭 → 닫힌 메뉴 콜백 10번 실행

## 원인
```typescript
// GameScene.ts ~2459
const closeOnClickOutside = (e: MouseEvent) => {
  if (!menu.contains(e.target as Node)) closeContextMenu();
};
document.addEventListener('mousedown', closeOnClickOutside);
// closeContextMenu()에서 removeEventListener 없음
```

## 수정 방향
```typescript
private _ctxMenuListener: ((e: MouseEvent) => void) | null = null;

openContextMenu() {
  this._ctxMenuListener = (e) => { if (!menu.contains(e.target as Node)) this.closeContextMenu(); };
  document.addEventListener('mousedown', this._ctxMenuListener);
}
closeContextMenu() {
  if (this._ctxMenuListener) {
    document.removeEventListener('mousedown', this._ctxMenuListener);
    this._ctxMenuListener = null;
  }
  menu.remove();
}
```
