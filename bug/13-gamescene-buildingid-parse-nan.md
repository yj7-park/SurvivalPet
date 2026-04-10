# Bug 13 — GameScene: buildingId 파싱 시 NaN 가능

## 심각도
높음

## 파일
`src/scenes/GameScene.ts` 라인 ~1163-1164

## 현상
`nearest.door.buildingId.split(',')[0]`의 결과를 숫자로 강제 변환하는데,
`buildingId` 형식이 예상(`"12,3"` 같은 좌표 형식)과 다르면 `NaN`이 반환된다.
이 값이 배열 인덱스나 좌표로 사용되면 `NaN` 전파로 인해
문 열기/닫기가 동작하지 않거나 엉뚱한 건물이 상호작용된다.

## 재현 시나리오
1. 건물 ID가 `","` 구분자 없이 저장된 경우 (예: `"building_42"`)
2. `split(',')[0]` → `"building_42"` → `Number(...)` → `NaN`
3. 문 상호작용(E키) 시 아무 반응 없음

## 원인
```typescript
// GameScene.ts ~라인 1163-1164
const bx = Number(nearest.door.buildingId.split(',')[0]);
const by = Number(nearest.door.buildingId.split(',')[1]);
// NaN 체크 없음, 타입 단언도 부적절
```

## 수정 방향
```typescript
const parts = nearest.door.buildingId.split(',');
const bx = parseInt(parts[0], 10);
const by = parseInt(parts[1], 10);
if (isNaN(bx) || isNaN(by)) {
  console.warn('[GameScene] Invalid buildingId format:', nearest.door.buildingId);
  return;
}
```
