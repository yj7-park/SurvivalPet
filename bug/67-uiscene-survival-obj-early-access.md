# Bug 67 — UIScene: survival 객체 초기화 전 접근 — 첫 프레임 TypeError

## 심각도
중간

## 파일
`src/ui/UIScene.ts` 라인 ~245+

## 현상
`update()` 는 `gs` (GameScene) null 체크 후 바로 `gs.survival.hp` 등에 접근한다.
GameScene이 존재하더라도 `survival` 객체는 게임 로직 초기화 이후에 설정된다.
게임 시작 첫 몇 프레임 동안 `gs.survival` 이 undefined 이면
`gs.survival.hp` 에서 TypeError가 발생해 UI가 통째로 동작하지 않는다.

## 재현 시나리오
1. 게임 씬 로드 직후 UIScene update() 호출
2. GameScene은 존재하지만 GameScene.init()이 아직 완료 전
3. `gs.survival === undefined` → `gs.survival.hp` 에서 TypeError
4. HP/Hunger 게이지가 프레임 1에서 에러, 이후 정상화

## 원인
```typescript
// UIScene.ts ~245
const gs = this.scene.get('GameScene') as GameScene;
if (!gs) return;
// gs.survival 초기화 여부 미확인
const hp = gs.survival.hp;  // undefined.hp → TypeError
```

## 수정 방향
```typescript
const gs = this.scene.get('GameScene') as GameScene;
if (!gs || !gs.survival) return;
const hp = gs.survival.hp;
```
