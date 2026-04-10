# Bug 41 — ProficiencySystem: 다음 레벨까지 필요 XP 계산 오류

## 심각도
높음

## 파일
`src/systems/ProficiencySystem.ts` 라인 ~69-73

## 현상
`getXPToNextLevel(type)` 가 "다음 레벨까지 남은 XP"가 아닌
"현재 레벨 달성에 필요한 총 누적 XP"를 반환한다.
숙련도 패널의 진행 바와 XP 표시가 실제보다 훨씬 큰 값을 보여주며,
이미 쌓인 XP를 무시하기 때문에 레벨업 조건 판단도 틀릴 수 있다.

## 재현 시나리오
1. 낚시 숙련도 Lv5, 현재 레벨 내 500 XP 누적
2. `requiredXP(5) = 1000` (레벨 5 달성에 필요한 총 XP)
3. UI에서 "다음 레벨까지 1000 XP 필요" 표시
4. 실제로는 1000 - 500 = 500 XP만 더 필요
5. 플레이어가 숙련도 진행이 매우 느리다고 착각

## 원인
```typescript
// ProficiencySystem.ts ~라인 69-73
getXPToNextLevel(type: ProficiencyType): number {
  const d = this.data.get(type)!;
  if (d.level >= MAX_LEVEL) return 0;
  return requiredXP(d.level);   // ← 누적 필요 XP 반환 (현재 보유 XP 미차감)
}
```

## 수정 방향
```typescript
getXPToNextLevel(type: ProficiencyType): number {
  const d = this.data.get(type)!;
  if (d.level >= MAX_LEVEL) return 0;
  return Math.max(0, requiredXP(d.level) - d.xp);  // 현재 XP 차감
}
```
`addXP()` 내 레벨업 조건 체크도 동일 기준으로 통일 필요.
