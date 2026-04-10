# Bug 46 — RoofSystem: 건물 밖으로 이동 시 지붕 투명도 미복원 가능

## 심각도
중간

## 파일
`src/systems/RoofSystem.ts`

## 현상
플레이어가 건물 안으로 들어가면 지붕 스프라이트를 반투명 처리하고,
건물 밖으로 나가면 불투명으로 복원한다.
그런데 플레이어가 맵 전환(MapTransitionSystem)으로 건물을 벗어나는 경우
`RoofSystem.update()` 가 호출되기 전에 씬이 바뀌어
반투명 상태의 지붕 스프라이트가 복원되지 않고 다음 맵에도 남는다.

## 재현 시나리오
1. 건물 내부에 진입 → 지붕 반투명 처리
2. 건물 문 대신 맵 경계를 통해 다음 맵으로 이동
   (이론적 케이스: 건물이 맵 경계에 걸쳐있는 경우)
3. 새 맵에서 이전 지붕 스프라이트가 alpha=0.3으로 렌더링됨
4. 플레이어가 실내 오브젝트가 없는 빈 하늘에서 반투명 지붕 패턴 목격

## 원인
```typescript
// RoofSystem.ts 내 update()
update(playerTX, playerTY) {
  for (const [key, roof] of this.roofs) {
    const inside = this.isPlayerInside(playerTX, playerTY, roof.bounds);
    roof.sprite.setAlpha(inside ? 0.3 : 1.0);
  }
}
// MapTransitionSystem이 먼저 실행되어 씬이 전환되면 update()가 이번 프레임에 미호출
```

## 수정 방향
맵 전환 직전(`onBeforeTransition` 훅 또는 `MapTransitionSystem.triggerTransition()`)에서
모든 지붕을 불투명으로 강제 복원:
```typescript
// MapTransitionSystem.ts
triggerTransition() {
  this.roofSystem?.restoreAllRoofs();   // 지붕 전부 alpha=1 복원
  // ... 전환 처리
}

// RoofSystem.ts
restoreAllRoofs() {
  for (const [, roof] of this.roofs) {
    roof.sprite.setAlpha(1.0);
  }
}
```
