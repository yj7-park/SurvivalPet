# Bug 38 — UIScene: baseMaxHp 미사용 변수로 매 프레임 불필요한 계산

## 심각도
낮음

## 파일
`src/scenes/UIScene.ts` 라인 ~314-318

## 현상
HUD 업데이트 시 `const baseMaxHp = gs.charStats.maxHp` 를 선언하지만
이후 `void baseMaxHp` 로 타입스크립트 unused-variable 경고만 억제한다.
실제로 이 값은 HP 레이블 표시에 사용되지 않으며 매 프레임(60fps) 불필요한
객체 속성 접근과 변수 할당이 발생한다.

## 재현 시나리오
- 게임 실행 중 항상 발생 (매 프레임)
- 성능 프로파일링 시 UIScene.update()에서 불필요한 연산 확인

## 원인
```typescript
// UIScene.ts ~라인 314-318
const debuff = gs.hungerSystem?.getMaxHpDebuff() ?? 0;
const baseMaxHp = gs.charStats.maxHp;    // ← 선언 후 미사용
const hpLabel = debuff > 0
  ? `HP ${Math.ceil(s.hp)}/${s.maxHp} (↓${debuff})`
  : `HP ${Math.ceil(s.hp)}/${s.maxHp}`;
void baseMaxHp;   // ← unused 경고 억제용 코드
```

## 수정 방향
HP 레이블에 `baseMaxHp` 를 실제로 활용하거나 완전히 제거:
```typescript
const debuff = gs.hungerSystem?.getMaxHpDebuff() ?? 0;
const baseMaxHp = gs.charStats.maxHp;
const hpLabel = debuff > 0
  ? `HP ${Math.ceil(s.hp)}/${baseMaxHp} (↓${debuff})`  // baseMaxHp 사용
  : `HP ${Math.ceil(s.hp)}/${baseMaxHp}`;
// void baseMaxHp 제거
```
