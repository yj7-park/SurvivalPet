# Bug 27 — BuildRenderer: 월드 Y 좌표 기반 depth로 원거리 건물 렌더 순서 붕괴

## 심각도
중간

## 파일
`src/rendering/BuildRenderer.ts` 라인 ~20, 35, 68

## 현상
건물 스프라이트의 depth를 `y + 2`, `y + 3`, `y + 6` 등 월드 Y 좌표 기반으로 설정한다.
맵 하단부(예: y = 3000px)에 건물을 지으면 depth 값이 3006이 되어
DarknessLayer(depth 50), HUD(depth 80~90) 등 고정 depth UI 요소보다 높아진다.
HUD가 건물 뒤에 숨거나 어둠 레이어가 건물 위에 그려지지 않는다.

## 재현 시나리오
1. 맵 하단(y > 1600px 이상)에 건물 건설
2. 야간에 DarknessLayer가 해당 건물 위에 렌더링되지 않아 건물이 밝게 보임
3. HUD 요소(체력 바, 인벤토리)가 건물 스프라이트에 가려짐

## 원인
```typescript
// BuildRenderer.ts ~라인 20
sprite.setDepth(worldY + 2);
// worldY가 크면 depth가 HUD(80~90)보다 커짐
```

## 수정 방향
타일 Y 좌표(픽셀 → 타일)로 변환 후 제한된 범위 내에서 depth 계산:
```typescript
const tileY = Math.floor(worldY / TILE_SIZE);
sprite.setDepth(30 + tileY * 0.1);   // 타일당 0.1씩만 증가, HUD 미만으로 유지
```
또는 플레이어·건물 등 게임 오브젝트 depth를 0~60 범위로 정규화.
