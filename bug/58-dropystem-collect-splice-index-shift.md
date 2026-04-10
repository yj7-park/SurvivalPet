# Bug 58 — DropSystem: collect 중 splice로 배열 인덱스 밀림 — 아이템 수집 누락

## 심각도
높음

## 파일
`src/systems/DropSystem.ts` 라인 ~(collect 루프 섹션)

## 현상
수집 범위 내 아이템을 순회하며 `splice(i, 1)` 로 즉시 제거할 때
배열 인덱스가 밀려 바로 다음 아이템이 건너뛰어진다.
아이템이 연속으로 붙어있으면 홀수 번째 아이템만 수집되는 현상이 나타난다.

## 재현 시나리오
1. 드롭 아이템 3개가 근접 위치에 겹쳐 있음
2. 플레이어가 수집 → 루프에서 [0]·[1]·[2] 순회
3. [0] 수집 후 splice → 배열 [1]→[0], [2]→[1]
4. i++ → i=1 이 됐을 때 원래 [1](현재[0])은 건너뜀
5. 2개만 수집, 1개 누락

## 원인
```typescript
// DropSystem.ts
for (let i = 0; i < this.drops.length; i++) {
  if (inRange(drop)) {
    collectDrop(this.drops[i]);
    this.drops.splice(i, 1);   // splice 후 i++ → 다음 요소 건너뜀
  }
}
```

## 수정 방향
```typescript
// 역순 순회로 해결
for (let i = this.drops.length - 1; i >= 0; i--) {
  if (inRange(this.drops[i])) {
    collectDrop(this.drops[i]);
    this.drops.splice(i, 1);
  }
}
// 또는: filter/별도 배열로 수집 후 일괄 제거
```
