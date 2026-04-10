# Bug 65 — GameScene: 문 ID split 결과 2개 미만 시 undefined 파싱

## 심각도
중간

## 파일
`src/scenes/GameScene.ts` 라인 ~2973-2974

## 현상
`buildingId.split(',')` 의 결과가 2개 미만이면 (잘못된 ID 형식)
`[0]`, `[1]` 인덱스가 `undefined` 를 반환한다.
`parseInt(undefined)` 는 `NaN` 을 반환하고, 이후
`buildSystem.getAt(NaN, NaN)` 이 undefined를 반환해
다음 줄에서 null 역참조가 발생한다.
기존 bug/13 의 buildingId NaN 문제와 유사하지만
문 파싱 경로(`doorStruct` 조회)에서 독립적으로 발생한다.

## 재현 시나리오
1. 네트워크 지연으로 손상된 buildingId 수신 (예: `"120"` — 쉼표 없음)
2. `split(',')` → `["120"]`
3. `parts[1]` → undefined → `parseInt(undefined)` → NaN
4. `buildSystem.getAt(120, NaN)` → undefined → doorStruct.type 에서 TypeError

## 원인
```typescript
// GameScene.ts ~2973
const [txStr, tyStr] = buildingId.split(',');
const tx = parseInt(txStr), ty = parseInt(tyStr); // tyStr이 undefined면 NaN
const doorStruct = buildSystem.getAt(tx, ty);
doorStruct.type;  // doorStruct가 undefined면 충돌
```

## 수정 방향
```typescript
const parts = buildingId.split(',');
if (parts.length < 2) return;
const tx = parseInt(parts[0]), ty = parseInt(parts[1]);
if (isNaN(tx) || isNaN(ty)) return;
const doorStruct = buildSystem.getAt(tx, ty);
if (!doorStruct) return;
```
