# Bug 36 — CharacterRenderer: depth 소수점 누적으로 멀티플레이 오버레이 깜빡임

## 심각도
중간

## 파일
`src/rendering/CharacterRenderer.ts` 라인 ~51, 124-132

## 현상
장비 오버레이(무기·방패·갑옷)의 depth를 `sprite.depth + 0.1/0.05/0.02` 로 설정한다.
멀티플레이에서 두 플레이어가 같은 타일에 겹칠 때
depth 값이 충돌(예: 35.1 vs 35.1)하여 렌더링 순서가 프레임마다 달라진다.
무기 스프라이트가 상대 캐릭터 앞뒤를 번갈아 그려지는 깜빡임이 발생한다.

## 재현 시나리오
1. 멀티플레이에서 두 플레이어가 동일 위치로 이동
2. 두 캐릭터 모두 depth = 35 (동일 y 좌표)
3. 두 무기 모두 depth = 35.1 → 렌더링 순서 비결정적
4. 매 프레임 무기가 앞뒤로 Z-fighting 발생

## 원인
```typescript
// CharacterRenderer.ts ~라인 124-132
weaponSprite.setDepth(depth + 0.1);
shieldSprite.setDepth(depth + 0.05);
armorSprite.setDepth(depth + 0.02);
// 다른 플레이어도 동일 depth 계산 → 충돌
```

## 수정 방향
플레이어 고유 ID를 depth 오프셋에 포함:
```typescript
const playerOffset = (this.playerId % 100) * 0.001;  // 플레이어마다 미세한 차이
weaponSprite.setDepth(depth + 0.1 + playerOffset);
```
또는 Phaser의 `setDepth` 대신 Container z-order 사용.
