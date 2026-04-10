# Bug 29 — ProficiencyPanel: PROF_ORDER 길이와 rows 배열 불일치 시 undefined 접근

## 심각도
중간

## 파일
`src/ui/ProficiencyPanel.ts` 라인 ~156-161

## 현상
`refresh()` 메서드에서 `PROF_ORDER` 배열을 순회하며 `this.rows[i]`와
`this.barGfxList[i]`에 인덱스로 접근한다. `PROF_ORDER`에 스킬이 추가/삭제되어
배열 길이가 `rows`, `barGfxList` 초기화 시의 길이와 달라지면
`undefined` 접근으로 인해 패널 렌더링이 중단된다.

## 재현 시나리오
1. `PROF_ORDER`에 새 스킬 추가 (`'archery'` 등)
2. 게임 시작 → 숙련도 패널 열기
3. `refresh()` 실행 → `this.rows[8]` → `undefined` → `.setText()` 호출 → TypeError

## 원인
```typescript
// ProficiencyPanel.ts ~라인 156-161
refresh() {
  PROF_ORDER.forEach((skill, i) => {
    this.rows[i].setText(...);       // rows 길이가 PROF_ORDER와 다를 수 있음
    this.barGfxList[i].clear();      // 동일 문제
  });
}
```

## 수정 방향
```typescript
refresh() {
  PROF_ORDER.forEach((skill, i) => {
    if (!this.rows[i] || !this.barGfxList[i]) return;  // 방어적 체크
    this.rows[i].setText(...);
    this.barGfxList[i].clear();
  });
}
```
또는 패널 생성 시 `PROF_ORDER.length` 기준으로 rows/barGfxList를 초기화하도록 보장.
