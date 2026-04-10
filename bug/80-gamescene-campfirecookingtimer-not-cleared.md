# Bug 80 — GameScene: shutdown 시 campfireCookingTimer 미해제

## 심각도
중간

## 파일
`src/scenes/GameScene.ts` 라인 ~159, 2046-2091

## 현상
`shutdown()` 에서 `cookingTimer` 는 정리하지만
`campfireCookingTimer` 는 `.remove()` 를 호출하지 않는다.
화롯불 요리가 진행 중일 때 씬을 재시작하면 타이머가 살아남아
새 씬에서도 이전 요리 완료 콜백이 실행된다.

## 재현 시나리오
1. 화롯불에 재료 넣고 요리 시작 → campfireCookingTimer 생성
2. 씬 재시작 (사망 또는 메뉴로 돌아가기)
3. 타이머 콜백이 새 씬에서 실행 → 존재하지 않는 화롯불에 아이템 추가 시도
4. TypeError 또는 아이템 중복 획득

## 원인
```typescript
// GameScene.ts ~2046 (shutdown)
this.cookingTimer?.remove();         // 일반 요리 타이머는 정리
// this.campfireCookingTimer?.remove() 없음
```

## 수정 방향
```typescript
// shutdown() 내 추가
this.campfireCookingTimer?.remove();
this.campfireCookingTimer = null;
```
