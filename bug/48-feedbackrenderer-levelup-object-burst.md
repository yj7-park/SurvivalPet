# Bug 48 — FeedbackRenderer: 멀티플레이 동시 레벨업 시 파티클 폭증 프레임 저하

## 심각도
낮음

## 파일
`src/rendering/FeedbackRenderer.ts` 라인 ~41-92

## 현상
`playLevelUpEffect()` 가 호출될 때마다 확장 링 2개, 별 파티클 12개,
텍스트 1개로 총 15개 Phaser 객체와 3개 트윈을 즉시 생성한다.
멀티플레이에서 4명이 동시에 레벨업하면 60개 객체 + 12개 트윈이
동시에 생성·소멸하여 1~2프레임 스파이크가 발생한다.

## 재현 시나리오
1. 4인 멀티플레이에서 모두 보스를 함께 처치
2. 동시에 레벨업 → `playLevelUpEffect()` 4회 연속 호출
3. 60개 Phaser 객체 즉시 생성
4. 60fps → 30fps 미만으로 순간 저하 (저사양 기기)

## 원인
```typescript
// FeedbackRenderer.ts ~라인 41-92
playLevelUpEffect(x, y) {
  // 링 2개
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.graphics();          // 신규 Graphics 생성
    scene.tweens.add({ targets: ring, ... });   // 신규 Tween 생성
  }
  // 별 12개
  for (let i = 0; i < 12; i++) {
    const star = scene.add.graphics();          // 신규 Graphics 생성
    scene.tweens.add({ targets: star, ... });   // 신규 Tween 생성
  }
  // 텍스트 1개
  const txt = scene.add.text(...);
  scene.tweens.add({ targets: txt, ... });
  // 총 15 Graphics + 15 Tweens
}
```

## 수정 방향
1. **오브젝트 풀링**: 링·파티클 스프라이트를 미리 생성해두고 재사용
2. **이펙트 병합**: 동일 프레임에 여러 레벨업 이펙트 요청 시 단일 큰 이펙트로 합산
3. **지연 생성**: `scene.time.delayedCall(i * 100, ...)` 로 분산 생성
```typescript
// 간단한 개선: 별 파티클은 Phaser emitter로 단일 객체 사용
const emitter = scene.add.particles(x, y, '__DEFAULT', { quantity: 12, ... });
emitter.explode(12);
scene.time.delayedCall(800, () => emitter.destroy());
// Graphics 대신 emitter 1개 → 파티클 12개 처리
```
