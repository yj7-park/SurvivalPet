# Bug 33 — EquipmentSystem: equippedWeaponId 미전달 시 양손무기 + 방패 동시 장착

## 심각도
높음

## 파일
`src/systems/EquipmentSystem.ts` 라인 ~13-28, 54-59

## 현상
`canEquip(slot, itemId, equippedWeaponId)` 의 `equippedWeaponId` 파라미터 기본값이 `null` 이다.
호출 측에서 현재 장착 무기 ID를 전달하지 않으면 양손 무기 검사가 우회되어
활 + 방패를 동시에 장착할 수 있다.

## 재현 시나리오
1. 활(양손 무기)을 장착한 상태
2. 방패 장착 시 `equip('shield', shieldId, inventory)` 호출
   (4번째 인자 `equippedWeaponId` 생략)
3. `TWO_HANDED_WEAPONS.has(null ?? '')` = `TWO_HANDED_WEAPONS.has('')` = false
4. 양손 무기 검사 통과 → 방패 장착 성공
5. 활 + 방패 동시 착용 → 전투 계산 오류

## 원인
```typescript
// EquipmentSystem.ts ~라인 54-59
canEquip(
  slot: keyof EquipmentSlots,
  itemId: string,
  inventory: Inventory,
  equippedWeaponId: string | null = null,   // ← 기본값 null
): EquipResult {
  if (slot === 'shield' && TWO_HANDED_WEAPONS.has(equippedWeaponId ?? '')) {
    return { ok: false, reason: '활은 양손 무기입니다.' };
  }
  // equippedWeaponId가 null이면 위 조건 항상 false → 검사 우회
}
```

## 수정 방향
```typescript
// 호출 측에서 반드시 현재 무기 ID 전달하도록 타입을 non-optional로 변경
canEquip(
  slot: keyof EquipmentSlots,
  itemId: string,
  inventory: Inventory,
  equippedWeaponId: string | null,   // 기본값 제거 → 필수 인자로
): EquipResult
```
또는 `equippedWeaponId === null` 일 때 현재 장착 무기를 EquipmentSystem 내부에서 직접 조회.
