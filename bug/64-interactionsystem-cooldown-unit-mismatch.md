# Bug 64 — InteractionSystem: 공격 쿨다운 단위 불일치 — 실제 쿨과 표시값 다름

## 심각도
중간

## 파일
`src/systems/InteractionSystem.ts` 라인 ~160, 187, 289

## 현상
`attackCooldown` 을 `this.stats.attackCooldown` (초 단위)으로 초기화하고
`delta` (밀리초 단위)로 감소시킨다.
`1초` 쿨다운이 `1ms`만에 소진되어 사실상 쿨다운이 없는 상태가 된다.
또는 표시 텍스트에서 `/ 1000` 을 적용해 표시는 정상처럼 보이지만
내부 실제 쿨이 의도보다 1000배 짧다.

## 재현 시나리오
1. 기본 공격 쿨다운 = 0.5초 (stats에서 초 단위)
2. `delta = 16ms` → 쿨다운이 16ms/0.5 = 0.032초 만에 소진
3. 초당 약 62회 공격 가능 → DPS 무한 상승

## 원인
```typescript
// InteractionSystem.ts ~160
this.attackCooldown = this.stats.attackCooldown; // 단위: 초 (예: 0.5)

// ~187
this.attackCooldown -= delta;  // delta: ms (예: 16)
// 0.5 - 16 = -15.5 → 즉시 소진
```

## 수정 방향
```typescript
// 통일 방법 A: 초기화 시 ms로 변환
this.attackCooldown = this.stats.attackCooldown * 1000;  // 500ms
this.attackCooldown -= delta;   // ms 단위로 감소

// 통일 방법 B: delta를 초 단위로 변환
this.attackCooldown -= delta / 1000;
```
