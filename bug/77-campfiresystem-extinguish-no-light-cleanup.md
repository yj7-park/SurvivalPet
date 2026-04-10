# Bug 77 — CampfireSystem: 화롯불 소화 시 LightSystem 광원 미제거

## 심각도
중간

## 파일
`src/systems/CampfireSystem.ts` 라인 ~(extinguish 섹션)

## 현상
화롯불이 소화될 때 CampfireSystem이 시각적 파티클/스프라이트는 제거하지만
LightSystem에 등록된 화롯불 광원 엔트리를 삭제하지 않는다.
소화된 화롯불 위치에 보이지 않는 광원이 계속 남아
어두운 맵에서 빈 공간이 밝게 보이는 시각 오류가 발생한다.

## 재현 시나리오
1. 화롯불 설치 → LightSystem에 광원 등록
2. 비 또는 물로 화롯불 소화
3. 화롯불 스프라이트 사라짐, 파티클 없음
4. 어둠 레이어에서 해당 위치만 여전히 밝게 유지

## 원인
```typescript
// CampfireSystem.ts (extinguish)
extinguish(campfireId: string) {
  this.campfires.delete(campfireId);
  this.visual?.removeCampfire(campfireId);
  // this.lightSystem?.removeLight(campfireId) 없음
}
```

## 수정 방향
```typescript
extinguish(campfireId: string) {
  this.campfires.delete(campfireId);
  this.visual?.removeCampfire(campfireId);
  this.lightSystem?.removeLight(campfireId);   // 광원 제거 추가
}
```
