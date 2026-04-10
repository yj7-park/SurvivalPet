# Bug 55 — CharacterRenderer: 방향 반전 로직 단방향 — left 방향 미반전

## 심각도
중간

## 파일
`src/rendering/CharacterRenderer.ts` 라인 ~73

## 현상
`'right'` → `'left'` 변환만 수행하고 `'left'` → `'right'` 변환은 없다.
스프라이트 flipX를 사용해 방향을 처리하는 구조에서 이 코드는
오른쪽으로 이동할 때만 스프라이트가 반전되고
왼쪽 이동 시 항상 기본(오른쪽) 스프라이트로 표시되어 방향이 어색하다.

## 재현 시나리오
1. 캐릭터를 왼쪽으로 이동
2. 스프라이트가 오른쪽 방향 그대로 표시됨 (flipX 적용 안 됨)
3. 오른쪽 이동 시에는 정상적으로 반전됨

## 원인
```typescript
// CharacterRenderer.ts ~73
const actualDir = dir === 'right' ? 'left' : dir;
// 'right'를 'left'로 매핑하지만 'left'를 'right'로 돌리는 로직 없음
// flipX와 연동되는 방향 테이블에서 'right' 키가 없으면 fallback 발생
```

## 수정 방향
```typescript
// flipX 기반이라면: 'left' 방향 스프라이트를 기준 스프라이트로 쓰고
// 'right' 이동 시 flipX=true 적용
const flipX = dir === 'right';
sprite.setFlipX(flipX);
const animDir = (dir === 'right') ? 'left' : dir;  // 애니메이션 키는 left 기준
```
