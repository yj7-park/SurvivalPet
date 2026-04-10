# Bug 40 — CharacterRenderer: HP ≤ 10 빨간 깜빡임 임계값이 maxHp와 무관

## 심각도
낮음

## 파일
`src/rendering/CharacterRenderer.ts` 라인 ~101

## 현상
HP ≤ 10 일 때 캐릭터 스프라이트에 빨간 깜빡임 효과를 적용한다.
CON을 높게 투자해 maxHp 330인 플레이어는 HP 10이어도 3% 체력인데
빨간 깜빡임이 매우 늦게 시작된다.
반대로 CON이 낮아 maxHp 90인 플레이어는 HP 10 = 11% 체력에서 깜빡임 시작.
`maxHp`에 관계없이 절댓값 10으로 고정되어 위기 경고가 일관성 없다.

## 재현 시나리오
1. CON 30 빌드 (maxHp 380): HP 10이 되어야 겨우 위험 경고
   → HP 11~30 구간에서 위험하지만 시각적 경고 없음
2. CON 1 빌드 (maxHp 90): HP 25 = 28%인데 빨간 깜빡임 없음
   → 실제로는 여유 있는 상황

## 원인
```typescript
// CharacterRenderer.ts ~라인 101
} else if (hp <= 10) {   // ← 절댓값 고정, maxHp 무시
  this.sprite.setTint(dangerTint);
}
```

## 수정 방향
maxHp 대비 비율로 변경:
```typescript
const hpRatio = hp / maxHp;
if (hpRatio <= 0.20) {   // 20% 이하에서 위험 경고
  this.sprite.setTint(dangerTint);
}
```
