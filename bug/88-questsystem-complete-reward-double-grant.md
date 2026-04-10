# Bug 88 — QuestSystem: 퀘스트 완료 보상 중복 지급 가능

## 심각도
높음

## 파일
`src/systems/QuestSystem.ts` 라인 ~(completeQuest 섹션)

## 현상
`completeQuest(questId)` 가 퀘스트 상태를 `completed` 로 변경하기 전에
보상(`grantReward()`)을 먼저 지급하는 순서로 구현되어 있다.
네트워크 지연이나 중복 호출로 `completeQuest()` 가 두 번 실행되면
두 번째 호출 시점에 상태가 아직 `in_progress` 이어서 보상이 이중 지급된다.

## 재현 시나리오
1. 퀘스트 완료 조건 달성 → 서버/클라 양측에서 `completeQuest()` 호출
2. 첫 호출: status=in_progress → 보상 지급 → status=completed
3. 두 번째 호출(동시): status=in_progress (아직 변경 전) → 보상 재지급
4. 골드·아이템 2배 획득

## 원인
```typescript
// QuestSystem.ts
completeQuest(questId) {
  const q = this.quests.get(questId);
  if (q?.status !== 'in_progress') return;

  this.grantReward(q);     // 먼저 보상 지급
  q.status = 'completed';  // 나중에 상태 변경 → 동시 호출 시 중복 위험
}
```

## 수정 방향
```typescript
completeQuest(questId) {
  const q = this.quests.get(questId);
  if (q?.status !== 'in_progress') return;

  q.status = 'completed';  // 먼저 상태 변경 (guard 역할)
  this.grantReward(q);     // 보상은 상태 변경 후
}
```
