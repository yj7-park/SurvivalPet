# Bug 61 — CombatSystem: 화살 타겟이 도중 삭제될 때 null 역참조

## 심각도
중간

## 파일
`src/systems/CombatSystem.ts` 라인 ~221-270

## 현상
`updateProjectiles()` 에서 `arrow['target']` 을 캐스팅해 `target.isDead` 와
`target.x`·`target.y` 에 접근한다.
화살이 비행 중에 대상 동물/몬스터가 다른 플레이어에 의해 제거되면
`target` 이 null/undefined가 되어 TypeError가 발생한다.

## 재현 시나리오
1. 플레이어 A가 화살 발사 → 몬스터 타겟 설정
2. 화살 비행 중 플레이어 B가 같은 몬스터를 처치 → 몬스터 삭제
3. 다음 프레임 `updateProjectiles()` → `target.isDead` 에서 TypeError

## 원인
```typescript
// CombatSystem.ts ~228
const target = arrow['target'] as Animal;
if (target.isDead) { ... }   // target이 null이면 충돌
const dx = target.x - arrow.x;
```

## 수정 방향
```typescript
const target = arrow['target'] as Animal | null;
if (!target || target.isDead) {
  // 화살 제거
  this.removeProjectile(arrow);
  continue;
}
```
