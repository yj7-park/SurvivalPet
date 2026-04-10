# Bug 39 — HungerSystem: maxDebuffCap을 고정 maxHp로 계산해 CON 스탯 변경 시 불일치

## 심각도
중간

## 파일
`src/systems/HungerSystem.ts` 라인 ~35

## 현상
굶주림 디버프 상한값을 `charStats.maxHp - 10` (고정값)으로 계산한다.
CON 스탯을 올려 maxHp가 증가해도 `maxDebuffCap` 은 스탯 배분 시점의 값으로
고정되어 있어, 새 maxHp에 비해 디버프 상한이 부적절하게 낮거나 높아진다.

## 재현 시나리오
1. CON 5 → maxHp 130, maxDebuffCap = 120
2. 굶주림으로 maxHpDebuff = 120 누적 → 실제 HP = 130 - 120 = 10
3. CON 포인트를 10으로 올림 → maxHp 180으로 증가
4. 하지만 maxDebuffCap은 여전히 120 (갱신 안 됨)
5. maxHp 180이지만 최대 디버프가 120에서 고정 → HP 최소 60이어야 하는데
   실제로는 HungerSystem이 새 maxHp를 반영하지 않아 계산 불일치

## 원인
```typescript
// HungerSystem.ts ~라인 35
const maxDebuffCap = charStats.maxHp - 10;
// charStats.maxHp는 update() 호출 시의 스냅샷 → 스탯 변경 즉시 반영 OK
// 하지만 this.maxHpDebuff를 클램핑하지 않아
// 이전에 누적된 debuff가 새 cap을 초과한 채로 유지될 수 있음
```

## 수정 방향
매 틱마다 누적된 debuff를 현재 cap으로 클램핑:
```typescript
update(delta, survival, charStats) {
  const maxDebuffCap = charStats.maxHp - 10;
  // 스탯이 낮아진 경우에도 debuff를 현재 cap 이하로 유지
  this.maxHpDebuff = Math.min(this.maxHpDebuff, maxDebuffCap);
  // ...이후 로직
}
```
