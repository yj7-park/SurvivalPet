# Bug 45 — CommandQueue: 실행 중 clearAll() 호출 시 currentCommand null 참조

## 심각도
중간

## 파일
`src/systems/CommandQueue.ts` 라인 ~58-65, 97-99

## 현상
명령이 실행(`status = 'executing'`) 중에 `clearAll()` 이 호출되면
`currentCommand` 가 즉시 null로 초기화된다.
명령 실행 핸들러가 이후 `getCurrentCommand()` 를 호출해
완료/실패를 보고하려 할 때 null이 반환되어 정리 코드가 실행되지 않는다.
결과적으로 진행 바가 사라지지 않거나 상호작용 잠금이 해제되지 않는다.

## 재현 시나리오
1. 나무 베기 명령 실행 중 (`status = 'executing'`)
2. 플레이어가 인벤토리 UI에서 "모든 명령 취소" 클릭
3. `clearAll()` → `this.currentCommand = null`, `this.queue = []`
4. 나무 베기 완료 콜백에서 `getCurrentCommand()` → null 반환
5. `completeCommand()` 미호출 → 진행 바가 0%에서 고착
6. 다음 명령 실행 시 이전 진행 바 UI가 남아있음

## 원인
```typescript
// CommandQueue.ts ~라인 97-99
clearAll(): void {
  this.queue = [];
  this.currentCommand = null;   // 실행 중인 명령도 즉시 null 처리
  this.notifyListeners();
}
```

## 수정 방향
```typescript
clearAll(): void {
  // 현재 실행 중인 명령에 취소 이벤트 발행 후 정리
  if (this.currentCommand) {
    this.currentCommand.status = 'cancelled';
    this.onCommandCancelled?.(this.currentCommand);
  }
  this.queue = [];
  this.currentCommand = null;
  this.notifyListeners();
}
```
또는 실행 중 명령은 `clearAll()` 대상에서 제외하고 자연 완료를 기다림.
