# Bug 68 — CharacterRenderer: 알 수 없는 애니메이션 키로 play() 호출 — 경고 폭증

## 심각도
낮음

## 파일
`src/rendering/CharacterRenderer.ts` 라인 ~(play 호출부)

## 현상
`sprite.play(animKey)` 호출 시 `animKey` 가 Phaser 애니메이션 레지스트리에
없는 경우 Phaser가 콘솔 경고를 매 프레임 출력한다.
새 캐릭터 타입이나 장비 조합에 따라 존재하지 않는 키가 생성될 수 있어
디버그 빌드에서 콘솔이 경고로 도배된다.

## 재현 시나리오
1. 새로운 캐릭터 스킨 또는 무기 타입 추가 (애니메이션 미등록)
2. 해당 캐릭터 이동 → `sprite.play('char_new_skin_walk_down')` 호출
3. 애니메이션이 없음 → 매 프레임 Phaser 경고 출력
4. 개발 시 실제 버그 경고가 묻힘

## 원인
```typescript
// CharacterRenderer.ts (play 호출부)
sprite.play(animKey);
// 애니메이션 존재 여부 사전 확인 없음
```

## 수정 방향
```typescript
if (this.scene.anims.exists(animKey)) {
  sprite.play(animKey, true);
} else {
  // fallback: 기본 idle 애니메이션 또는 프레임 0 유지
  if (!sprite.anims.isPlaying) sprite.setFrame(0);
}
```
