# Bug 75 — DeathScreen: 버튼 마우스 이벤트 핸들러 누적

## 심각도
낮음

## 파일
`src/ui/DeathScreen.ts` 라인 ~45-47

## 현상
`show()` 를 호출할 때마다 버튼 요소에 `onmouseenter` / `onmouseleave`
핸들러를 새로 할당하지 않고 이전 핸들러를 덮어씌운다.
그러나 DOM 요소가 재사용될 경우 기존 `addEventListener` 방식과
혼재하면 이벤트가 중복 등록되어 버튼이 예상보다 여러 번 반응한다.
또한 `destroy()` 에서 핸들러를 명시적으로 제거하지 않아
DOM 누수 가능성이 있다.

## 재현 시나리오
1. 플레이어 사망 → DeathScreen.show()
2. 리스폰 후 다시 사망 → DeathScreen.show() 재호출
3. 버튼 호버 시 핸들러 중복 실행 가능

## 원인
```typescript
// DeathScreen.ts ~45
btn.onmouseenter = () => { btn.style.background = '#...'; };
btn.onmouseleave = () => { btn.style.background = '#...'; };
// destroy() 에서 제거 없음
```

## 수정 방향
```typescript
// destroy()에서 명시적 제거
destroy() {
  if (this.retryBtn) {
    this.retryBtn.onmouseenter = null;
    this.retryBtn.onmouseleave = null;
  }
  this.container?.remove();
  this.container = null;
}
```
