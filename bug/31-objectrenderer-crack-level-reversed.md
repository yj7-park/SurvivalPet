# Bug 31 — ObjectRenderer: 균열 레벨 역순 매핑으로 멀쩡한 건물에 균열 표시

## 심각도
높음

## 파일
`src/rendering/ObjectRenderer.ts` 라인 ~13-17

## 현상
`showCracks(ratio)` 에서 `ratio`가 **내구도 비율**(1.0 = 완전, 0.0 = 파괴 직전)임에도
높은 ratio에 높은 균열 레벨을 매핑한다.
결과적으로 방금 지은 건물(내구도 100%)에 심한 균열이 표시되고,
거의 부서진 건물(내구도 5%)에 가벼운 균열만 표시된다.

## 재현 시나리오
1. 벽을 새로 건설 (내구도 100% = ratio 1.0)
2. `ratio >= 0.66` → `level = 3` (심한 균열) 표시
3. 벽을 계속 공격해 내구도 10%로 감소 (ratio 0.10)
4. `ratio < 0.33` → `level = 1` (가벼운 균열) 표시
5. 피해가 심할수록 균열이 줄어드는 역설적 상황

## 원인
```typescript
// ObjectRenderer.ts ~라인 13-17
showCracks(tx, ty, ratio) {
  let level: 1 | 2 | 3;
  if (ratio < 0.33)       level = 1;   // 낮은 내구도 → 가벼운 균열 (역전)
  else if (ratio < 0.66)  level = 2;
  else                    level = 3;   // 높은 내구도 → 심한 균열 (역전)
}
```

## 수정 방향
DurabilitySystem.getCrackLevel()과 일치시킴:
```typescript
showCracks(tx, ty, ratio) {
  if (ratio >= 0.70) return;           // 균열 없음
  const level = ratio >= 0.40 ? 1
              : ratio >= 0.20 ? 2 : 3;
  this.crackOverlay.show(tx, ty, level);
}
```
