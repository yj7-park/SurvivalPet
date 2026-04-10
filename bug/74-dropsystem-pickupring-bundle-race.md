# Bug 74 — DropSystem: pickupRing destroy 후 bundle 참조 잔류

## 심각도
낮음

## 파일
`src/systems/DropSystem.ts` 라인 ~255-266

## 현상
`collectDrop()` 에서 `bundle.pickupRing.destroy()` 를 호출하지만
`bundle` 객체 자체는 `groundItems` 에 남아 있다.
같은 프레임에서 `update()` 루프가 다시 실행되면
이미 파괴된 `pickupRing` 에 접근해 Phaser 내부 에러가 발생한다.

## 재현 시나리오
1. 수집 범위 내 아이템 두 개 겹침
2. 첫 번째 아이템 수집 → pickupRing.destroy(), groundItems에서 splice
3. splice 인덱스 오류(bug 58)로 두 번째 아이템 같은 프레임 재처리
4. 이미 destroy된 pickupRing에 접근 → TypeError

## 원인
```typescript
// DropSystem.ts ~264
bundle.pickupRing.destroy();
this.groundItems.splice(i, 1);  // splice 후 i가 밀림 (bug58 연계)
// 다음 루프에서 bundle.pickupRing 재접근 가능
```

## 수정 방향
```typescript
collectDrop(bundle) {
  if (bundle.pickupRing) {
    bundle.pickupRing.destroy();
    bundle.pickupRing = null;  // null 처리로 재접근 방지
  }
  // 역순 splice 또는 filter 방식 사용 (bug58 수정과 연계)
}
```
