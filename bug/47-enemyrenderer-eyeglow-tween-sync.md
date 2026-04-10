# Bug 47 — EnemyRenderer: 적 재등장 시 eyeGlow tween 위치 동기화 불일치

## 심각도
낮음

## 파일
`src/rendering/EnemyRenderer.ts` 라인 ~18-42

## 현상
`setEyeGlow(id, x, y, visible=true)` 를 같은 id로 재호출하면
기존 트윈은 유지한 채로 스프라이트 위치만 업데이트한다.
트윈이 `left.x -= 1` 같은 상대 좌표 애니메이션을 적용 중이라면
위치를 갱신해도 트윈이 다시 스프라이트를 이전 위치로 끌어당겨
눈 빛이 적 스프라이트와 분리되어 보이는 시각 오류가 발생한다.

## 재현 시나리오
1. 적이 화면 밖으로 나갔다가 다시 진입 (pool 재사용)
2. `setEyeGlow(id, newX, newY, true)` 호출 → 위치 갱신
3. 기존 트윈이 `{x: oldX - 1}` 로 여전히 진행 중
4. 눈 빛이 적 머리가 아닌 이전 위치 근처에서 맥동

## 원인
```typescript
// EnemyRenderer.ts ~라인 38-41
} else {
  // 기존 entry 위치만 업데이트
  entry.left.setPosition(x - 3, y - 8);
  entry.right.setPosition(x + 3, y - 8);
  // 이전 트윈은 여전히 실행 중 → 위치 덮어쓰기 충돌
}
```

## 수정 방향
재사용 시 트윈을 리셋:
```typescript
} else {
  entry.tween.stop();
  entry.left.setPosition(x - 3, y - 8);
  entry.right.setPosition(x + 3, y - 8);
  entry.tween = this.scene.tweens.add({ targets: [entry.left, entry.right], ... });
}
```
