# Bug 16 — DropSystem: amountMin > amountMax 미검증으로 음수 드롭

## 심각도
중간

## 파일
`src/systems/DropSystem.ts` 라인 ~75

## 현상
드롭 테이블에서 `amountMax - amountMin + 1`을 계산할 때
`amountMin > amountMax`인 항목이 있으면 결과가 0 또는 음수가 된다.
`Math.floor(rng.next() * 음수)`는 음수 아이템 수량으로 처리되어
인벤토리에 마이너스 스택이 추가되거나 드롭이 전혀 없는 버그가 발생한다.

## 재현 시나리오
1. `dropTables.ts`에서 실수로 `amountMin: 3, amountMax: 1` 설정
2. 해당 몬스터 처치 시 드롭 수량 계산 → 음수 → 인벤토리 스택 오류

## 원인
```typescript
// DropSystem.ts ~라인 75
const amount = entry.amountMin +
  Math.floor(rng.next() * (entry.amountMax - entry.amountMin + 1));
// amountMin > amountMax 이면 amount가 amountMin보다 작아짐
```

## 수정 방향
```typescript
const min = Math.min(entry.amountMin, entry.amountMax);
const max = Math.max(entry.amountMin, entry.amountMax);
const amount = min + Math.floor(rng.next() * (max - min + 1));
```
또는 드롭 테이블 로드 시점에 유효성 검증 추가.
