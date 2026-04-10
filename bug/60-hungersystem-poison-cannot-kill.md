# Bug 60 — HungerSystem: 독 데미지 Math.max(1,...) 로 죽지 않음

## 심각도
높음

## 파일
`src/systems/HungerSystem.ts` 라인 ~61

## 현상
독 상태의 HP 감소 로직이 `Math.max(1, survival.hp - POISON_HP_DAMAGE)` 를 사용해
HP가 1 미만으로 내려가지 않는다.
플레이어가 독에 걸려도 영원히 HP 1을 유지하며 사망하지 않는다.
독으로 인한 긴장감이 완전히 사라진다.

## 재현 시나리오
1. 독버섯 섭취 → 독 상태 진입
2. HP가 1까지 감소
3. 이후 독 틱이 계속 오지만 HP는 1에 고정
4. 자연 회복으로 독 해제 가능 → 사망 없음

## 원인
```typescript
// HungerSystem.ts ~61
survival.hp = Math.max(1, survival.hp - POISON_HP_DAMAGE);
// 의도: 즉사 방지? 실제: 독으로는 절대 사망 불가
```

## 수정 방향
```typescript
// 독으로도 사망 가능하게 0 허용
survival.hp = Math.max(0, survival.hp - POISON_HP_DAMAGE);
// HPSystem 또는 호출부에서 hp === 0 시 사망 처리
if (survival.hp <= 0) hpSystem.triggerDeath(playerId);
```
