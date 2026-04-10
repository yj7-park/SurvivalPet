# Bug 32 — DurabilitySystem vs ObjectRenderer: 균열 임계값 불일치

## 심각도
높음

## 파일
- `src/systems/DurabilitySystem.ts` 라인 ~19-24
- `src/rendering/ObjectRenderer.ts` 라인 ~13-17

## 현상
`DurabilitySystem.getCrackLevel()` 과 `ObjectRenderer.showCracks()` 가
각각 다른 임계값으로 균열 레벨을 계산한다.
두 곳에서 동일 내구도 비율에 대해 다른 균열 레벨이 도출되어
표시되는 균열이 실제 내구도와 일치하지 않는다.

## 불일치 비교

| 내구도 비율 | DurabilitySystem | ObjectRenderer |
|------------|-----------------|----------------|
| 0.80 | level 0 (없음) | level 3 (심함) |
| 0.50 | level 1 (약함) | level 2 (보통) |
| 0.30 | level 2 (보통) | level 1 (약함) |
| 0.10 | level 3 (심함) | level 1 (약함) |

## 원인
두 파일이 독립적으로 임계값을 정의하며 동기화되지 않음:
```typescript
// DurabilitySystem.ts
if (durRatio >= 0.70) return 0;
if (durRatio >= 0.40) return 1;
if (durRatio >= 0.20) return 2;
return 3;

// ObjectRenderer.ts (역순)
if (ratio < 0.33) level = 1;
else if (ratio < 0.66) level = 2;
else level = 3;
```

## 수정 방향
ObjectRenderer에서 DurabilitySystem의 함수를 직접 사용:
```typescript
import { getCrackLevel } from '../systems/DurabilitySystem';

showCracks(tx, ty, ratio) {
  const level = getCrackLevel(ratio);
  if (level === 0) { this.hideCracks(tx, ty); return; }
  this.crackOverlay.show(tx, ty, level);
}
```
