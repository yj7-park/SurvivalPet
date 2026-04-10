# Bug 35 — HPSystem: 상태이상 + 피격 동시 발생 시 HP=1에서 사망 미발생

## 심각도
중간

## 파일
`src/systems/HPSystem.ts` 라인 ~33-40
`src/systems/HungerSystem.ts` 라인 ~관련 코드

## 현상
식중독(`isPoisoned`)으로 HP가 1까지 내려간 상태에서 적에게 피격되면
`Math.max(1, hp - damage)` 로 HP가 1로 고정된 채 사망하지 않는다.
독 데미지와 물리 데미지가 각각 `Math.max(1, ...)` 로 제한되어
중첩 적용 시 의도한 사망 조건이 발동하지 않는다.

## 재현 시나리오
1. 식중독 상태로 HP = 3
2. 늑대에게 10 피해 받음
3. `Math.max(1, 3 - 10) = 1` → HP 1로 설정, 사망 판정 없음
4. 계속 늑대가 공격해도 HP 1에서 무한 생존
5. 플레이어가 죽지 않고 화면이 빨간색으로만 깜빡임

## 원인
```typescript
// HungerSystem.ts (독 피해)
survival.hp = Math.max(1, survival.hp - POISON_HP_DAMAGE);

// HPSystem.ts (물리 피해)
survival.hp = Math.max(1, survival.hp - damage);

// 두 시스템 모두 독립적으로 Math.max(1, ...) 적용
// → 사망(hp <= 0) 조건에 절대 도달 불가
```

## 수정 방향
데미지 적용 후 사망 조건을 체크하는 중앙화된 함수 사용:
```typescript
// HPSystem.ts
applyDamage(survival: SurvivalStats, damage: number): void {
  survival.hp = Math.max(0, survival.hp - damage);
  if (survival.hp <= 0) {
    this.triggerDeath(survival);
  }
}
// HungerSystem에서도 동일한 applyDamage() 호출
```
