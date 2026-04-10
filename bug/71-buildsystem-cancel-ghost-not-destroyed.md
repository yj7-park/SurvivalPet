# Bug 71 — BuildSystem: cancelBuild 시 고스트 스프라이트 미제거

## 심각도
낮음

## 파일
`src/systems/BuildSystem.ts` 라인 ~224-229

## 현상
`pauseBuild()` 후 `cancelBuild()` 를 호출하면
활성 배치 고스트 스프라이트가 화면에 남아 있다.
`cancelBuild()` 는 상태만 초기화하고 Phaser 오브젝트를 제거하지 않아
빈 공간에 반투명 건물 고스트가 떠 있는 시각 버그가 발생한다.

## 재현 시나리오
1. 건물 배치 시작 → 고스트 스프라이트 생성
2. `pauseBuild()` 호출 (게임 메뉴 열기 등)
3. 메뉴에서 건설 취소 → `cancelBuild()` 호출
4. 고스트 스프라이트가 화면에 계속 표시됨

## 원인
```typescript
// BuildSystem.ts ~224
cancelBuild() {
  this.activeTarget = null;
  this.state = 'idle';
  // this.ghostSprite?.destroy() 없음
}
```

## 수정 방향
```typescript
cancelBuild() {
  this.ghostSprite?.destroy();
  this.ghostSprite = null;
  this.activeTarget = null;
  this.state = 'idle';
}
```
