# Bug 86 — GameScene: 문 buildingId NaN 체크 없이 Math.floor 호출

## 심각도
중간

## 파일
`src/scenes/GameScene.ts` 라인 ~1163-1164

## 현상
`nearest.door.buildingId.split(',')[0]` 결과에 대해 기수 없이 `parseInt` 후
`Math.floor()` 를 연쇄 호출한다.
`buildingId` 가 빈 문자열이거나 쉼표 없는 형태이면
`parseInt(undefined, ...)` 또는 `parseInt('', ...)` → NaN,
`Math.floor(NaN)` → NaN 이 되어 후속 건물 조회 함수에
NaN 좌표가 전달된다. 이때 조회 결과가 예기치 않게 성공할 수 있다
(Map의 NaN 키는 문자열 "NaN"으로 저장되기 때문).

## 재현 시나리오
1. 네트워크 지연으로 buildingId = "" (빈 문자열) 수신
2. `parseInt("", 10)` → NaN
3. `buildSystem.getAt(NaN, ...)` → Map.get("NaN") 조회 시도
4. 잘못된 건물 데이터 반환 가능

## 원인
```typescript
// GameScene.ts ~1163
const bParts = nearest.door.buildingId.split(',');
const bx = Math.floor(parseInt(bParts[0]) as unknown as number);
// NaN 체크 없음, 기수 미지정
```

## 수정 방향
```typescript
const bParts = nearest.door.buildingId?.split(',') ?? [];
if (bParts.length < 2) return;
const bx = parseInt(bParts[0], 10);
const by = parseInt(bParts[1], 10);
if (isNaN(bx) || isNaN(by)) return;
```
