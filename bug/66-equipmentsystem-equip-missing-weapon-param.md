# Bug 66 — EquipmentSystem: equip() 호출 시 현재 무기 ID 미전달 — 방패 중복 장착 허용

## 심각도
중간

## 파일
`src/systems/EquipmentSystem.ts` 라인 ~9-29

## 현상
`canEquip(itemType, equippedWeaponId?)` 는 두손 무기 장착 여부를 검사하지만
`equippedWeaponId` 가 선택적(optional) 파라미터이다.
호출부에서 해당 인자를 생략하면 두손 무기를 든 상태에서도
방패를 추가로 장착할 수 있다.
`handleWeaponEquip()` 은 이를 올바르게 처리하지만
다른 경로(예: 드래그-드롭 장착)에서 인자를 빠뜨리면 검사가 우회된다.

## 재현 시나리오
1. 두손 대검 장착
2. 인벤토리에서 방패를 오프핸드 슬롯으로 드래그
3. 호출부에서 `equip('shield')` (weaponId 인자 생략)
4. 두손 무기 + 방패 동시 장착 → 밸런스 붕괴

## 원인
```typescript
// EquipmentSystem.ts ~9
canEquip(itemType: string, equippedWeaponId?: string): boolean {
  if (!equippedWeaponId) return true;  // 생략 시 항상 통과
  // ...
}
```

## 수정 방향
```typescript
// equip() 내부에서 현재 무기를 자체 조회하도록 변경
canEquip(itemType: string): boolean {
  const currentWeapon = this.equippedItems.get('mainhand');
  if (currentWeapon && this.isTwoHanded(currentWeapon)) {
    return itemType !== 'shield';
  }
  return true;
}
```
