# Bug 56 — ObjectRenderer: crack 스프라이트 조회 시 null 체크 없음

## 심각도
중간

## 파일
`src/rendering/ObjectRenderer.ts` 라인 ~(crack 관련 섹션)

## 현상
`updateCrackOverlay(id, ratio)` 에서 `this.crackMap.get(id)` 가 undefined를
반환할 때 null 체크 없이 `.setFrame()` 을 호출해 런타임 TypeError가 발생한다.
오브젝트가 파괴된 직후 마지막 데미지 틱이 도착하는 타이밍에 주로 발생한다.

## 재현 시나리오
1. 나무/바위를 빠르게 연속 공격
2. 파괴 → `removeObject(id)` → crackMap에서 삭제
3. 같은 프레임에 `updateCrackOverlay(id, ...)` 호출
4. `crackMap.get(id)` === undefined → `.setFrame()` 에서 TypeError

## 원인
```typescript
// ObjectRenderer.ts
updateCrackOverlay(id: string, ratio: number): void {
  const crack = this.crackMap.get(id);
  crack.setFrame(Math.floor(ratio * 4));  // crack이 undefined면 TypeError
}
```

## 수정 방향
```typescript
updateCrackOverlay(id: string, ratio: number): void {
  const crack = this.crackMap.get(id);
  if (!crack) return;
  crack.setFrame(Math.floor(ratio * 4));
}
```
