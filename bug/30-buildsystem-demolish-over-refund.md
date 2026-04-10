# Bug 30 — BuildSystem: 철거 시 Math.ceil로 소량 자원 과다 반환

## 심각도
낮음

## 파일
`src/systems/BuildSystem.ts` 라인 ~269-274

## 현상
철거 환급량을 `Math.ceil(count * returnRatio)` 로 계산하는데,
자원이 소량(1~2개)이고 `returnRatio = 0.25` 인 경우
`ceil(1 * 0.25) = ceil(0.25) = 1` 로 원래 수량 전체가 반환된다.
예를 들어 통나무 1개로 만든 구조물을 철거하면 통나무 1개가 돌아와
사실상 무료로 건축 후 철거를 반복할 수 있다.

## 재현 시나리오
1. 통나무 1개로 울타리 건설
2. 울타리 철거 (`returnRatio = 0.25`)
3. `Math.ceil(1 * 0.25) = 1` → 통나무 1개 반환 (100% 반환)
4. 재건설 → 철거 → 무한 반복 → 자원 손실 없음

## 원인
```typescript
// BuildSystem.ts ~라인 273
const refundCount = Math.ceil(count * returnRatio);
// 소량 자원에서 ceiling으로 인해 100% 반환
```

## 수정 방향
```typescript
const refundCount = Math.max(0, Math.floor(count * returnRatio));
// floor 사용으로 과다 반환 방지
// 단, 의도적으로 최소 1개 반환을 원한다면 아래처럼:
// Math.min(count - 1, Math.ceil(count * returnRatio))
```
