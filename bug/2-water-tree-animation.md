## 문제 상황
- 물(Water): `water_ripple` 애니메이션이 등록·재생되고 있으나, 나무 재성장(`startRegrowAnimation`)과 지도 리로드 시 새 스프라이트에는 재생이 보장되어야 함 — 이미 처리 중.
- 나무(Tree): 정적 스프라이트만 존재. 바람에 흔들리는 idle sway 애니메이션이 전혀 없음.

## 원인 파악
- `src/rendering/TreeRenderer.ts:30` — `addTree()` 는 static `Sprite` 만 생성하고 아무런 애니메이션/tween 을 적용하지 않음.
- 각 나무 스프라이트의 origin 이 `(0,0)` 이라 회전 중심이 좌상단이어서 trunk-base 기준 흔들기가 불가.
- `removeTreeWithFall` / `removeTree` 에서 기존 tween 정리가 없어 sway tween 충돌 가능성.

## 해결 방안
1. `TreeRenderer.addTree()` 에서 origin 을 `(0.5, 1.0)` 으로 변경 (trunk-base 기준 회전)
2. 트리별 랜덤 딜레이+주기 sway tween 추가 (yoyo, Sine.easeInOut)
3. `removeTree()` / `removeTreeWithFall()` / `startRegrowAnimation()` 에서 기존 tween 정리 추가
