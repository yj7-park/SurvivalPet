# Bug 59 — HungerSystem: 최대체력 감소 시 기존 디버프가 새 상한선 초과

## 심각도
중간

## 파일
`src/systems/HungerSystem.ts` 라인 ~33-52

## 현상
`maxDebuffCap`은 현재 `charStats.maxHp` 기준으로 매 프레임 재계산된다.
최대체력이 증가할 경우 상한선도 함께 올라가 문제없다.
그러나 최대체력이 감소(장비 해제·저주 등)하면 새 `maxDebuffCap`이 낮아지는데
이미 저장된 `maxHpDebuff` 값이 새 상한선을 초과한 채로 유지된다.
결과적으로 실제 최대체력이 음수 또는 0 이하로 계산될 수 있다.

## 재현 시나리오
1. 굶주림 디버프 누적: maxHpDebuff = 80
2. CON 장비 해제 → charStats.maxHp 감소 → maxDebuffCap = 50
3. `effectiveMaxHp = charStats.maxHp - maxHpDebuff` = 음수 가능

## 원인
```typescript
// HungerSystem.ts ~40
const maxDebuffCap = charStats.maxHp * HUNGER_DEBUFF_RATIO;
// maxHpDebuff는 별도로 클램핑되지 않음
survival.maxHp = charStats.maxHp - this.maxHpDebuff;  // 음수 가능
```

## 수정 방향
```typescript
const maxDebuffCap = charStats.maxHp * HUNGER_DEBUFF_RATIO;
this.maxHpDebuff = Math.min(this.maxHpDebuff, maxDebuffCap);
survival.maxHp = Math.max(1, charStats.maxHp - this.maxHpDebuff);
```
