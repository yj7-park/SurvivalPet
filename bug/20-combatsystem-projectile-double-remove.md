# Bug 20 — CombatSystem: 투사체 배열 역순 splice 중 이중 제거 가능

## 심각도
높음

## 파일
`src/systems/CombatSystem.ts` 라인 ~221-270 (`updateProjectiles`)

## 현상
투사체(화살 등) 업데이트 루프에서 `for` 역순 순회 + `splice`를 사용하는데,
같은 프레임에 하나의 투사체가 "벽 충돌"과 "적 충돌" 두 조건을 동시에 만족하면
두 개의 `splice(i, 1)` 호출이 발생한다.
첫 번째 splice 이후 인덱스가 이미 제거되어 두 번째 splice는 엉뚱한 투사체를 삭제한다.

## 재현 시나리오
1. 화살을 벽 바로 앞에 있는 적에게 발사
2. 동일 프레임에 벽 충돌 + 적 충돌 조건 모두 true
3. 두 번의 splice → 다른 투사체가 삭제되고 실제 충돌 투사체는 계속 날아감
4. 화살이 벽을 통과하는 시각 오류 + 다른 화살 소멸

## 원인
```typescript
// CombatSystem.ts ~라인 221-270
for (let i = projectiles.length - 1; i >= 0; i--) {
  const p = projectiles[i];
  if (hitWall(p)) {
    projectiles.splice(i, 1);  // 첫 번째 제거
    // continue 없음
  }
  if (hitEnemy(p)) {
    projectiles.splice(i, 1);  // 두 번째 제거 → 다른 항목 삭제
  }
}
```

## 수정 방향
```typescript
for (let i = projectiles.length - 1; i >= 0; i--) {
  const p = projectiles[i];
  if (hitWall(p)) {
    projectiles.splice(i, 1);
    continue;  // 이미 제거됐으므로 다음으로
  }
  if (hitEnemy(p)) {
    projectiles.splice(i, 1);
  }
}
```
또는 `toRemove: Set<number>` 방식으로 제거 예약 후 일괄 처리.
