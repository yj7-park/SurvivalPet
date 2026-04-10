# Bug 63 — FeedbackRenderer: 레벨업 텍스트 트윈 onComplete 없음 — 객체 미삭제 누수

## 심각도
높음

## 파일
`src/rendering/FeedbackRenderer.ts` 라인 ~83-86

## 현상
`playLevelUpEffect()` 내 레벨업 텍스트 스케일 트윈에 `onComplete` 핸들러가 없어
트윈 종료 후 `lvText` 객체가 씬에 계속 남아있다.
레벨업이 반복될수록 화면에 보이지 않는 텍스트 객체가 누적되어
메모리 사용량이 증가하고 성능이 저하된다.

## 재현 시나리오
1. 연속 레벨업 (경험치 치트 등)
2. 매 레벨업마다 `lvText` 1개 씬에 잔류
3. 50레벨 달성 시 50개 비가시 텍스트 객체 존재

## 원인
```typescript
// FeedbackRenderer.ts ~83
scene.tweens.add({
  targets: lvText,
  scaleX: 0, scaleY: 0, alpha: 0,
  duration: 600,
  delay: 800,
  // onComplete 없음 → lvText.destroy() 미호출
});
```

## 수정 방향
```typescript
scene.tweens.add({
  targets: lvText,
  scaleX: 0, scaleY: 0, alpha: 0,
  duration: 600,
  delay: 800,
  onComplete: () => lvText.destroy(),
});
```
