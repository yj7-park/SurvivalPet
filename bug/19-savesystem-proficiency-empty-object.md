# Bug 19 — SaveSystem: 구형 저장 데이터 로드 시 proficiency 빈 객체

## 심각도
중간

## 파일
`src/systems/SaveSystem.ts` 라인 ~211-212

## 현상
이전 버전에서 저장된 데이터에 `proficiency` 필드가 없을 경우
`data.character['proficiency'] = {}` 로 빈 객체를 할당한다.
이후 `ProficiencySystem`이 `cooking`, `crafting` 등 특정 키의 숫자값을 기대하는데
빈 객체에서는 `undefined`가 반환되어 숙련도 레벨이 전부 `NaN`으로 처리된다.

## 재현 시나리오
1. v0.13 이전에 저장된 게임 데이터 로드
2. `proficiency.cooking` → `undefined` → `undefined + xp = NaN`
3. 숙련도 바가 렌더링되지 않거나 레벨업이 무한 발생

## 원인
```typescript
// SaveSystem.ts ~라인 211-212
if (!data.character.proficiency) {
  data.character.proficiency = {};   // 빈 객체 → 각 스킬 값 undefined
}
```

## 수정 방향
```typescript
const DEFAULT_PROFICIENCY = {
  cooking: 0, crafting: 0, building: 0,
  logging: 0, mining: 0, fishing: 0,
  combat: 0, farming: 0,
};

if (!data.character.proficiency) {
  data.character.proficiency = { ...DEFAULT_PROFICIENCY };
} else {
  // 누락된 스킬만 기본값으로 채움
  data.character.proficiency = {
    ...DEFAULT_PROFICIENCY,
    ...data.character.proficiency,
  };
}
```
