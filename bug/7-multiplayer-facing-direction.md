# Bug 7 — MultiplayerVisualSystem: 원격 플레이어 오른쪽 방향 반전 오류

## 심각도
높음

## 파일
`src/systems/MultiplayerVisualSystem.ts`

## 현상
원격 플레이어의 `facing === 'right'` 일 때 방향을 `'left'`로 변환하는 코드가 있다.
결과적으로 오른쪽으로 이동하는 원격 플레이어의 스프라이트가 왼쪽을 향하게 되어
애니메이션 방향이 반전된 채로 표시된다.

## 재현 시나리오
1. 멀티플레이 세션에서 2명 이상 접속
2. 한 플레이어가 오른쪽(→)으로 이동
3. 다른 플레이어 화면에서 해당 플레이어가 왼쪽 방향 스프라이트로 이동함

## 원인
```typescript
// MultiplayerVisualSystem.ts ~라인 49
const remDir = p.facing === 'right' ? 'left' : p.facing;
// 'right'를 'left'로 바꾸는 이유 불명확
// flipX 처리와 충돌하는 것으로 추정
```

## 수정 방향
`flipX`를 통해 방향을 처리한다면 `remDir` 변환 불필요:
```typescript
sprite.setFlipX(p.facing === 'left');
// remDir 변환 로직 제거
const remDir = p.facing;
```
로컬 플레이어 렌더링 방식과 일치하는지 확인 필요.
