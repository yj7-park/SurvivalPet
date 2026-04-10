# Bug 22 — CampfireSystem: 소화 확률이 프레임레이트에 종속

## 심각도
중간

## 파일
`src/systems/CampfireSystem.ts` 라인 ~283

## 현상
비 올 때 모닥불 소화 확률을 `Math.random() < baseChance * (delta / 16.67)` 로 계산한다.
16.67ms(60fps 기준)로 정규화하지만 실제 게임이 30fps로 실행되면
`delta ≈ 33ms` → `baseChance * 2.0` 으로 확률이 2배가 된다.
저사양 기기에서 모닥불이 비정상적으로 빠르게 꺼진다.

## 재현 시나리오
1. 저사양 기기(30fps)에서 비 오는 날씨
2. 모닥불이 이론상 분당 1% 확률로 꺼져야 하는데 실제로는 2% 확률로 꺼짐
3. 고사양(120fps)에서는 오히려 0.5% 확률 → 모닥불이 거의 꺼지지 않음

## 원인
```typescript
// CampfireSystem.ts ~라인 283
const extChance = baseChance * (delta / 16.67);
if (Math.random() < extChance) {
  this.extinguish(cf);
}
// delta가 클수록 확률도 선형 증가 → 프레임레이트 의존
```

## 수정 방향
단위 시간당 확률을 포아송 과정으로 변환:
```typescript
// 초당 기댓값으로 정의 후 delta(ms)에 맞게 변환
const ratePerSec = baseChance;           // 초당 소화 확률
const prob = 1 - Math.exp(-ratePerSec * delta / 1000);
if (Math.random() < prob) {
  this.extinguish(cf);
}
```
