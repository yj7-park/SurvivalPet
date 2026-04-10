# Bug 2 — DarknessLayer / WarmLightLayer: campfire 타입 불일치

## 심각도
높음

## 파일
- `src/ui/DarknessLayer.ts`
- `src/systems/WarmLightLayer.ts`

## 현상
`LightSource.type`이 3가지(예: `'torch' | 'campfire_warm' | 'player'`)로 정의되어 있는데,
`DarknessLayer`의 `FLICKER_AMP` / `FLICKER_PERIOD` 테이블과 `WarmLightLayer`의 `LIGHT_WARM_COLORS`가
`'campfire'` 키를 사용한다. 타입 불일치로 인해 campfire 조명의 flicker 진폭과 색상이 `undefined`로 처리된다.

## 재현 시나리오
1. 게임 내에서 모닥불(campfire)을 설치
2. 야간에 모닥불 근처에 접근
3. 조명 반경이 표시되지 않거나 색상이 흰색으로 고정됨

## 원인
```typescript
// DarknessLayer.ts
const FLICKER_AMP: Record<string, number> = {
  campfire: 12,    // ← LightSource.type 에 'campfire' 없음
  torch: 6,
};

// WarmLightLayer.ts
const LIGHT_WARM_COLORS: Record<string, number> = {
  campfire: 0xff6600,  // ← 동일 문제
};
```

## 수정 방향
`LightSource` 인터페이스의 type 리터럴에 `'campfire'` 추가하거나,
`FLICKER_AMP` / `LIGHT_WARM_COLORS`의 키를 실제 타입 값과 일치시킨다.
```typescript
type LightSourceType = 'torch' | 'campfire' | 'campfire_warm' | 'player';
```
