# Bug 34 — UIScene: GameScene 참조 실패 시 음식 섭취 이펙트에서 크래시

## 심각도
중간

## 파일
`src/scenes/UIScene.ts` 라인 ~192-216

## 현상
음식 섭취 이펙트 재생을 위해 `this.scene.get('GameScene')` 으로 GameScene을 참조한다.
GameScene이 아직 초기화되지 않았거나, 씬 전환 도중 참조하면
`fullGs.player?.sprite?.x` 에서 player가 undefined 여서 크래시가 발생한다.

## 재현 시나리오
1. 타이틀 → 게임 로딩 중 빠르게 음식 단축키 입력
2. UIScene은 이미 활성화됐지만 GameScene은 아직 create() 완료 전
3. `fullGs.player` = undefined → `fullGs.player.sprite` → TypeError
4. 게임이 멈추거나 흰 화면 표시

## 원인
```typescript
// UIScene.ts ~라인 192-206
const fullGs = this.scene.get('GameScene') as unknown as { ... };
const px = fullGs.player?.sprite?.x ?? 0;   // player가 undefined면 문제 없어 보이지만
// 아래처럼 호출되는 경우
fullGs.feedbackRenderer?.playEatEffect(px, py, hunger);
// feedbackRenderer 접근 전 fullGs 자체가 null일 수 있음
```

## 수정 방향
```typescript
const gs = this.scene.get('GameScene');
if (!gs || !(gs as any).player) return;   // GameScene 미준비 시 조기 반환
const fullGs = gs as unknown as { ... };
```
