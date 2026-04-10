# Bug 72 — WeatherParticleSystem: fogLayerA/B 트윈 실행 중 destroy 후 참조

## 심각도
중간

## 파일
`src/systems/WeatherParticleSystem.ts` 라인 ~344-356

## 현상
`stopFog()` 에서 fogLayerA를 즉시 `destroy()` 하지 않고 트윈 `onComplete`에서 파괴한다.
그런데 안개가 빠르게 재시작되면 `startFog()` 가 이미 파괴 예약된 동일 객체에
새 트윈을 추가하려 한다. 트윈이 완료되기 전 `startFog()` 가 호출되면
파괴 중인 객체에 접근해 Phaser 경고 또는 에러가 발생한다.

## 재현 시나리오
1. 안개 시작 → fogLayerA 생성
2. 안개 중지 → 페이드아웃 트윈 (500ms) 시작
3. 트윈 완료 전에 (200ms 후) 다시 안개 시작
4. 파괴 예약된 fogLayerA에 새 트윈 추가 → 에러

## 원인
```typescript
// WeatherParticleSystem.ts ~348
this.scene.tweens.add({
  targets: this.fogLayerA,
  alpha: 0,
  duration: 500,
  onComplete: () => { this.fogLayerA?.destroy(); this.fogLayerA = null; }
  // 트윈 실행 중 fogLayerA가 startFog()에 의해 재사용 시도됨
});
```

## 수정 방향
```typescript
stopFog() {
  // 즉시 참조 분리
  const layerA = this.fogLayerA;
  const layerB = this.fogLayerB;
  this.fogLayerA = null;
  this.fogLayerB = null;
  this.fogTweenA?.stop(); this.fogTweenA = null;
  this.fogTweenB?.stop(); this.fogTweenB = null;

  if (layerA) {
    this.scene.tweens.add({
      targets: layerA, alpha: 0, duration: 500,
      onComplete: () => layerA.destroy(),
    });
  }
  if (layerB) {
    this.scene.tweens.add({
      targets: layerB, alpha: 0, duration: 500,
      onComplete: () => layerB.destroy(),
    });
  }
}
```
