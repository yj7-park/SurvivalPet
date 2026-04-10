# Bug 14 — GameScene: beforeunload 이벤트 리스너 중복 등록

## 심각도
중간

## 파일
`src/scenes/GameScene.ts` 라인 ~1289-1292

## 현상
`GameScene`이 생성될 때 `window.addEventListener('beforeunload', handler)`를 등록하지만,
씬 destroy 시 해당 리스너를 제거하지 않는다.
게임 재시작(타이틀 → 게임 씬 재진입)을 반복하면 handler가 누적되어
페이지 종료 시 저장 로직이 여러 번 실행된다.

## 재현 시나리오
1. 게임 시작 → 플레이 → 타이틀로 복귀 → 다시 게임 시작 (3회 반복)
2. 브라우저 탭 닫기
3. `beforeunload` 핸들러가 3번 호출 → Firebase에 데이터 3회 저장 시도 → 경쟁 쓰기 발생

## 원인
```typescript
// GameScene.ts ~라인 1289-1292
create() {
  const beforeUnloadHandler = () => this.saveSystem.save(0);
  window.addEventListener('beforeunload', beforeUnloadHandler);
  // shutdown()이나 destroy()에서 removeEventListener 없음
}
```

## 수정 방향
```typescript
private beforeUnloadHandler?: () => void;

create() {
  this.beforeUnloadHandler = () => this.saveSystem.save(0);
  window.addEventListener('beforeunload', this.beforeUnloadHandler);
}

shutdown() {
  if (this.beforeUnloadHandler) {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.beforeUnloadHandler = undefined;
  }
}
```
