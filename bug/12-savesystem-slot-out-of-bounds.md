# Bug 12 — SaveSystem: 슬롯 인덱스 범위 검증 부재

## 심각도
높음

## 파일
`src/systems/SaveSystem.ts` 라인 ~126, ~154

## 현상
`save(slot)` / `load(slot)` 호출 시 `this.SLOT_KEYS[slot]`에 접근하는데
`slot` 값의 유효 범위(0~2)를 사전에 검증하지 않는다.
범위 외 슬롯 번호가 전달되면 `undefined`가 키로 사용되어
잘못된 Firebase 경로에 데이터를 저장하거나 `undefined` 경로에서 로드를 시도한다.

## 재현 시나리오
1. `SaveSystem.save(-1)` 또는 `SaveSystem.save(99)` 호출
2. `SLOT_KEYS[-1]` → `undefined` → Firebase 경로가 `"/saves/undefined/..."` 가 됨
3. 저장 데이터 손상 또는 로드 실패

## 원인
```typescript
// SaveSystem.ts ~라인 126
async save(slot: number) {
  const key = this.SLOT_KEYS[slot];  // slot 범위 미검증
  await db.ref(`saves/${key}`).set(data);
}
```

## 수정 방향
```typescript
async save(slot: number) {
  if (slot < 0 || slot >= this.SLOT_KEYS.length) {
    console.error(`[SaveSystem] Invalid slot: ${slot}`);
    return;
  }
  const key = this.SLOT_KEYS[slot];
  await db.ref(`saves/${key}`).set(data);
}
```
