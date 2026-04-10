## 문제 상황
캐릭터 스프라이트에 `idle`/`walk` 애니메이션만 존재한다.
이동, 공격, 벌목, 채굴, 요리, 제작 등 각 동작에서 캐릭터가 모두 동일한
idle/walk 모션만 재생되어 시각적 피드백이 전혀 없다.

## 원인 파악
- `src/rendering/AnimationManager.ts:12` — `idle_{skin}_{dir}` / `walk_{skin}_{dir}` 두 종류만 등록
- `src/rendering/CharacterRenderer.ts:74` — `isMoving` 플래그 하나만 보고 walk/idle 결정
- `src/scenes/GameScene.ts:1773` — `charRenderer.update()` 에 `actionState` 개념 없음

## 해결 방안
1. `AnimationManager` — 기존 walk 프레임을 재활용해 4가지 액션 애니메이션 추가:
   - `chop_{skin}_{dir}` (10fps) — 벌목
   - `mine_{skin}_{dir}` (8fps)  — 채굴
   - `work_{skin}_{dir}` (3fps)  — 요리·낚시
   - `attack_{skin}_{dir}` (14fps) — 전투
2. `InteractionSystem` — `getActiveGatherType()` 메서드 추가로 현재 수집 종류 노출
3. `CharacterRenderer.update()` — `actionState` 파라미터 추가, 상태에 맞는 애니메이션 재생
4. `GameScene` — 렌더 루프에서 actionState 판단 후 charRenderer 에 전달
