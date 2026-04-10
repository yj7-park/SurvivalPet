# Bug 76 — LightSystem: 이동 중인 엔티티의 횃불 광원 위치 미갱신

## 심각도
중간

## 파일
`src/rendering/LightSystem.ts` 라인 ~(addLight/updateLight 섹션)

## 현상
횃불이나 광원을 `addLight(entityId, x, y)` 로 추가한 뒤
엔티티가 이동해도 `update()` 에서 광원 위치를 자동으로 갱신하지 않는다.
플레이어가 횃불을 들고 이동하면 빛의 원이 출발 지점에 고정되어
어두운 곳에서 이동 방향이 밝아지지 않고 뒤쪽만 밝다.

## 재현 시나리오
1. 플레이어가 횃불 장착 → 현재 위치에 광원 등록
2. 플레이어 이동
3. 빛 원이 초기 등록 위치에 고정 — 이동한 위치는 어둠

## 원인
```typescript
// LightSystem.ts
addLight(id, x, y, radius) {
  this.lights.set(id, { x, y, radius });
}
// update() 에서 엔티티 현재 위치로 x,y 갱신 없음
```

## 수정 방향
```typescript
// 광원 위치 갱신 API 추가
updateLightPosition(id: string, x: number, y: number): void {
  const light = this.lights.get(id);
  if (light) { light.x = x; light.y = y; }
}
// 플레이어 update()에서 매 프레임 호출
lightSystem.updateLightPosition('player', player.x, player.y);
```
