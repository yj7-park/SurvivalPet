# Bug 69 — WeatherParticleSystem: stopFog 후 fogTweenA/B null 미설정

## 심각도
중간

## 파일
`src/systems/WeatherParticleSystem.ts` 라인 ~345, 352

## 현상
`stopFog()` 에서 `fogTweenA.stop()` / `fogTweenB.stop()` 을 호출하지만
참조 변수를 null로 초기화하지 않는다.
이후 안개가 다시 시작될 때 `if (!this.fogTweenA)` 가드가 통과되지 않아
새 트윈이 생성되지 않거나, 기존 중지된 트윈이 남아있어 동작이 예측 불가능하다.

## 재현 시나리오
1. 안개 날씨 시작 → fogTweenA/B 생성
2. 맑은 날씨로 변경 → stopFog() 호출 (stop, 미null)
3. 다시 안개 날씨 → fogTweenA !== null → 생성 로직 건너뜀
4. 안개 레이어가 맥동하지 않음

## 원인
```typescript
// WeatherParticleSystem.ts ~345
stopFog() {
  this.fogTweenA?.stop();   // null 미설정
  this.fogTweenB?.stop();
}
```

## 수정 방향
```typescript
stopFog() {
  this.fogTweenA?.stop();
  this.fogTweenA = null;
  this.fogTweenB?.stop();
  this.fogTweenB = null;
}
```
