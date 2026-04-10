# Bug 8 — MultiplayerVisualSystem: 존재하지 않는 스킨 텍스처 접근

## 심각도
중간

## 파일
`src/systems/MultiplayerVisualSystem.ts`

## 현상
원격 플레이어 스프라이트 생성 시 `char_skin${p.skin}` 텍스처 키를 동적으로 조합하는데,
해당 텍스처가 씬에 로드되어 있는지 확인하지 않는다.
정의되지 않은 스킨 번호(예: 999)가 Firebase에서 수신되면 스프라이트 생성이 실패하거나
Phaser 기본 텍스처('__DEFAULT')로 표시된다.

## 재현 시나리오
1. 사용자가 비정상적인 skin 값을 Firebase에 저장 (데이터 조작)
2. 다른 플레이어가 해당 데이터 수신
3. `scene.add.sprite(x, y, 'char_skin999')` → 텍스처 없음 → 에러 또는 빈 스프라이트

## 원인
```typescript
// MultiplayerVisualSystem.ts ~라인 74
const sprite = scene.add.sprite(x, y, `char_skin${p.skin}`);
// 텍스처 존재 여부 확인 없음
```

## 수정 방향
```typescript
const skinKey = `char_skin${p.skin}`;
const textureKey = scene.textures.exists(skinKey) ? skinKey : 'char_skin0';
const sprite = scene.add.sprite(x, y, textureKey);
```
