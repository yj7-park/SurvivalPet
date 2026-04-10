# Bug 15 — DropSystem: 순회 중 컬렉션 수정 (ConcurrentModification)

## 심각도
중간

## 파일
`src/systems/DropSystem.ts` 라인 ~305

## 현상
`destroy()` 메서드에서 `spriteBundles.keys()` 이터레이터로 순회하는 도중
같은 Map에서 `delete()`를 호출한다.
JavaScript의 `Map` 이터레이터는 순회 중 delete가 허용되지만,
내부 콜백에서 추가 삭제가 일어나는 경우 일부 항목이 건너뛰어져
스프라이트가 destroy되지 않고 메모리에 잔류할 수 있다.

## 재현 시나리오
1. 지면에 아이템 20개 이상 존재
2. GameScene 종료 (타이틀 복귀)
3. `DropSystem.destroy()` 호출 → 일부 스프라이트 Phaser 씬에 잔류
4. 다음 게임 세션에서 고아 스프라이트로 인한 오류

## 원인
```typescript
// DropSystem.ts ~라인 305
destroy() {
  for (const key of this.spriteBundles.keys()) {
    this.removeDropItem(key);  // 내부에서 spriteBundles.delete(key) 호출
  }
}
```

## 수정 방향
```typescript
destroy() {
  const keys = Array.from(this.spriteBundles.keys());
  for (const key of keys) {
    this.removeDropItem(key);
  }
}
```
