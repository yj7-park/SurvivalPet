# Bug 1 — WeatherParticleSystem: 안개 Tween 메모리 누수

## 심각도
높음

## 파일
`src/systems/WeatherParticleSystem.ts`

## 현상
안개(fog) 날씨를 시작할 때 `fogLayerA`, `fogLayerB`에 대한 tween을 생성하지만 참조를 저장하지 않는다.
`stopFog()` 호출 시 해당 tween을 중단하지 못해 이미 destroy된 객체 위에서 tween이 계속 실행된다.

## 재현 시나리오
1. 날씨가 fog로 전환됨
2. 짧은 시간 내에 다시 clear/rain 등 다른 날씨로 전환
3. 장시간 반복 → tween 누적 → 메모리 증가 및 destroy된 RenderTexture 접근으로 에러 발생

## 원인
```typescript
// stopFog()에서 아래처럼 참조 없이 tween 생성
scene.tweens.add({ targets: this.fogLayerA, alpha: 0.4, ... });
scene.tweens.add({ targets: this.fogLayerB, alpha: 0.3, ... });
// → this.fogTweenA / this.fogTweenB 에 저장하지 않음
```

## 수정 방향
```typescript
// tween 참조 필드 추가
private fogTweenA?: Phaser.Tweens.Tween;
private fogTweenB?: Phaser.Tweens.Tween;

// 생성 시 저장
this.fogTweenA = scene.tweens.add({ targets: this.fogLayerA, alpha: 0.4, ... });

// stopFog() 시 중단
this.fogTweenA?.stop();
this.fogTweenA = undefined;
```
