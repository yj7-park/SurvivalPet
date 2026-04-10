# Bug 83 — GameScene: parseInt 기수(radix) 미지정 — 옥탈 파싱 위험

## 심각도
낮음

## 파일
`src/scenes/GameScene.ts` 라인 ~2977-2978

## 현상
`parseInt(buildingId.split(',')[0])` 에서 기수를 생략했다.
좌표 문자열이 `"08,12"` 형태일 때 일부 환경(엄격 모드 이전)에서
`08` 을 8진수로 해석해 0을 반환한다.
현대 JS 엔진에선 문제없지만 `"0x..."` 형태의 손상된 ID가 오면
16진수 파싱이 발생해 예상 밖의 타일 좌표로 건물 조회가 실패한다.

## 재현 시나리오
1. buildingId = "0x10,0x20" (16진수 형태의 손상 데이터)
2. `parseInt("0x10")` → 16 (10진수가 아닌 16진수로 파싱)
3. `buildSystem.getAt(16, 32)` → 잘못된 타일 조회

## 원인
```typescript
// GameScene.ts ~2977
const tx = parseInt(parts[0]);     // 기수 생략
const ty = parseInt(parts[1]);
```

## 수정 방향
```typescript
const tx = parseInt(parts[0], 10);  // 항상 10진수 명시
const ty = parseInt(parts[1], 10);
```
