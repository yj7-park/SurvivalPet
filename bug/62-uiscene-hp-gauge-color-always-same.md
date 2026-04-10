# Bug 62 — UIScene: HP 게이지 색상 삼항 연산 양쪽이 동일 — 저체력 색 미변경

## 심각도
중간

## 파일
`src/ui/UIScene.ts` 라인 ~276

## 현상
HP 비율에 따라 게이지 색을 바꾸려는 삼항 연산의 참·거짓 양쪽이
동일한 값 `UI_COLORS.gaugeHpHex` 를 반환한다.
플레이어 HP가 20% 이하로 떨어져도 게이지 색이 변하지 않아
위험 상태를 시각적으로 인지할 수 없다.

## 재현 시나리오
1. HP를 20% 이하로 낮춤
2. HP 게이지가 항상 동일한 녹색/기본 색 유지
3. 긴급 상황 시각 피드백 없음

## 원인
```typescript
// UIScene.ts ~276
const hpColor = hpRatio <= 0.2
  ? UI_COLORS.gaugeHpHex    // ← 저체력 색
  : UI_COLORS.gaugeHpHex;   // ← 정상 색 (동일)
// 복사·붙여넣기 실수로 두 값이 동일해짐
```

## 수정 방향
```typescript
const hpColor = hpRatio <= 0.2
  ? 0xff4422   // 저체력: 붉은색
  : UI_COLORS.gaugeHpHex;  // 정상: 기본 색
```
