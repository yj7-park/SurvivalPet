# Bug 53 — FarmingSystem: 침략 이벤트 맵 키 형식 불일치로 중복 생성

## 심각도
높음

## 파일
`src/systems/FarmingSystem.ts` 라인 ~70, 157

## 현상
이벤트를 저장할 때 키를 `"${day}_${idx}"` 형식으로 사용하지만
중복 검사 시에는 `"${day}"` 형식으로 조회한다.
두 형식이 다르므로 중복 검사가 항상 통과해 같은 날 이벤트가 여러 번 생성된다.

## 재현 시나리오
1. day=5에 침략 이벤트 생성 → key = "5_0" 으로 저장
2. 다음 update() 에서 중복 검사: `invasionMap.has("5")` → false (항상)
3. 이벤트 재생성 → 동일 날짜에 침략이 중복 발동

## 원인
```typescript
// 저장 (line ~157)
this.invasionMap.set(`${day}_${idx}`, events[idx]);   // key: "5_0"

// 조회 (line ~70)
if (this.invasionMap.has(`${day}`)) return;            // key: "5" — 불일치
```

## 수정 방향
키 형식을 한 곳에서 통일:
```typescript
// 단일 이벤트/일 구조라면
this.invasionMap.set(`${day}`, event);
if (this.invasionMap.has(`${day}`)) return;
```
