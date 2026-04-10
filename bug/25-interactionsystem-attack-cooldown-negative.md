# Bug 25 — InteractionSystem: 공격 쿨다운 음수 허용으로 무한 공격 가능

## 심각도
중간

## 파일
`src/systems/InteractionSystem.ts` 라인 ~160

## 현상
공격 쿨다운을 `this.stats.attackCooldown` 으로 설정하는데,
`attackCooldown` 값이 음수이면 쿨다운이 즉시 0 이하가 되어
공격이 무제한으로 빠르게 실행된다.
AGI 스탯 계산 버그(plan 64 파생 스탯)나 장비 버프가 잘못 합산되면
음수 쿨다운이 발생할 수 있다.

## 재현 시나리오
1. AGI를 30까지 올린 후 공격속도 버프 장비 착용
2. `attackCooldown = baseCooldown - AGI * 10 - equipBonus` → 음수 가능
3. 공격 버튼 클릭 1회 → 프레임마다 공격 → 적이 1프레임에 수십 번 피격

## 원인
```typescript
// InteractionSystem.ts ~라인 160
startAttack() {
  this.attackCooldown = this.stats.attackCooldown;
  // stats.attackCooldown이 음수여도 그대로 할당
}
// 라인 187: Math.max(0, ...) 로 감소는 처리하지만
// 초기값 음수이면 이미 0 이하 → 즉시 재공격 가능
```

## 수정 방향
```typescript
startAttack() {
  this.attackCooldown = Math.max(100, this.stats.attackCooldown);
  // 최소 100ms 쿨다운 보장
}
```
파생 스탯 계산 시에도 `attackCooldown` 하한값 클램핑 필요.
