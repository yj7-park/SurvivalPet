# Bug 11 — MultiplayerSystem: forceUploadPosition에서 hp/hunger/fatigue 0 전송

## 심각도
높음

## 파일
`src/systems/MultiplayerSystem.ts` 라인 ~172

## 현상
`forceUploadPosition()` 호출 시 `hp`, `hunger`, `fatigue`를 모두 `0`으로 하드코딩하여 Firebase에 업로드한다.
맵 전환·씬 재시작 시점에 이 함수가 호출되면 다른 플레이어들에게 해당 플레이어가
HP 0 (사망 상태)으로 표시된다.

## 재현 시나리오
1. 멀티플레이 세션에서 2인 이상 접속
2. 한 플레이어가 맵 경계에서 이동 (맵 전환)
3. 다른 플레이어 화면에서 해당 플레이어 이름 태그가 HP 0으로 표시되고 사망 연출이 재생될 수 있음

## 원인
```typescript
// MultiplayerSystem.ts ~라인 172
forceUploadPosition() {
  db.ref(playerPath).set({
    x: this.player.x,
    y: this.player.y,
    hp: 0,       // ← 실제 HP가 아닌 0
    hunger: 0,   // ← 실제 hunger가 아닌 0
    fatigue: 0,  // ← 실제 fatigue가 아닌 0
    facing: this.player.facing,
  });
}
```

## 수정 방향
```typescript
forceUploadPosition() {
  db.ref(playerPath).set({
    x: this.player.x,
    y: this.player.y,
    hp:      this.survivalStats.hp,
    hunger:  this.survivalStats.hunger,
    fatigue: this.survivalStats.fatigue,
    facing:  this.player.facing,
  });
}
```
