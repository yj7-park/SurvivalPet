# Bug 37 — DeathScreen: 씬 재시작 시 DOM 사망 화면 미제거

## 심각도
중간

## 파일
`src/ui/DeathScreen.ts` 라인 ~10, 51-52

## 현상
`DeathScreen.show()` 가 `document.body.appendChild(overlay)` 로 DOM에 직접 삽입한다.
게임 재시작(타이틀로 복귀 → 다시 시작) 시 `destroy()` 가 호출되지 않으면
이전 사망 화면 div가 DOM에 잔류하여 새 게임 화면 위에 검은 오버레이가 겹친다.

## 재현 시나리오
1. 게임 중 사망 → 사망 화면 표시
2. 브라우저 뒤로 가기 버튼으로 타이틀로 이동 (destroy() 미호출)
3. 새 게임 시작
4. 게임 화면 위에 반투명 검은 사망 화면이 남아있음
5. 새 게임이 시작됐지만 화면 전체가 어둡게 보임

## 원인
```typescript
// DeathScreen.ts ~라인 10, 51
show() {
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);   // DOM에 추가
  this.overlay = overlay;
}

destroy() {
  this.overlay?.remove();  // 명시적 destroy() 호출 시에만 제거
  this.overlay = null;
}
// 씬 전환 시 destroy()가 항상 호출된다는 보장 없음
```

## 수정 방향
```typescript
show() {
  // 기존 overlay 있으면 먼저 제거
  this.destroy();
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);
  this.overlay = overlay;
}

// 또는 GameScene.shutdown()에서 반드시 호출 보장
shutdown() {
  this.deathScreen.destroy();
  // ...
}
```
