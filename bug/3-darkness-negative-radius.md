# Bug 3 — DarknessLayer: 조명 반지름 음수 가능

## 심각도
중간

## 파일
`src/ui/DarknessLayer.ts`

## 현상
flicker noise가 크게 계산될 경우 조명 반지름 `r`이 음수가 된다.
Phaser의 `fillCircle(x, y, r)` 또는 Canvas `arc(x, y, r, ...)` 에 음수 반지름을 전달하면
렌더링이 깨지거나 콘솔 에러가 발생한다.

## 재현 시나리오
1. 야간에 모닥불/횃불 켜기
2. `FLICKER_AMP` 값이 기본 반지름(baseRadius)보다 클 때
3. flicker 계산 결과 `r < 0` → 조명이 순간적으로 사라지거나 에러 발생

## 원인
```typescript
// DarknessLayer.ts ~라인 52-75
const noise = Math.sin(t * FLICKER_PERIOD[type]) * FLICKER_AMP[type];
const r = baseRadius + noise;   // ← r이 음수 가능
rt.erase(circle, cx - r, cy - r);  // 음수 r 전달
```

## 수정 방향
```typescript
const r = Math.max(0, baseRadius + noise);
```
