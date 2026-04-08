# 설계 11 — 클릭 이동 · 명령 선택 시스템

> **전제 조건**: 10 단계 완료 상태.
> 키보드 이동, A* 경로탐색, 상호작용 시스템, 명령 큐가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. 필드 타일 클릭으로 이동 가능하도록 변경
2. 클릭 위치 피드백 이펙트
3. 여러 명령이 가능한 대상에 hold-click 명령 선택 UI 구현
4. 단일 명령 / 빠른 클릭 / hold-click 동작 규칙 확정

---

## 2. 클릭 이동

### 2-1. 이동 가능한 클릭 대상

| 클릭 대상 | 이동 여부 | 비고 |
|-----------|-----------|------|
| 빈 흙 타일 | ✅ | 해당 위치로 이동 |
| 물 타일 | ✅ | 이동 (속도 50%), 또는 낚시 선택 가능 |
| 암반 타일 | ❌ | 이동 불가, 채굴 명령만 |
| 나무 오브젝트 | ❌ | 이동 불가, 벌목 명령만 |
| 구조물 | ❌ | 이동 불가, 상호작용 명령만 |
| 동물 / 적군 | ❌ | 이동 불가, 공격 명령만 |

### 2-2. 기존 키보드 이동과 병행

- 방향키 입력은 기존과 동일하게 즉시 수동 이동 (큐 초기화)
- 클릭 이동과 키보드 이동은 독립적으로 작동
- 클릭 이동 중 방향키 입력 시 → 클릭 이동 취소, 수동 이동으로 전환

---

## 3. 클릭 피드백 이펙트

클릭한 위치에 이동 목적지임을 나타내는 이펙트 표시.

```
이펙트 형태: 클릭 지점에 원형 링이 나타났다 사라짐

  단계 1 (0.0~0.1초): 작은 원 → 큰 원으로 확장 (scale 0.2 → 1.0)
  단계 2 (0.1~0.5초): 투명도 감소 (alpha 1.0 → 0.0)

색상:
  이동 명령: 흰색 (#ffffff), 얇은 링 (2px)
  공격 명령: 빨간색 (#ff4444)
  채집/상호작용 명령: 노란색 (#ffdd00)

크기: 타일 크기 기준 (32px 직경)
```

Shift + 클릭(큐 추가) 시에도 동일 이펙트 표시.

---

## 4. 클릭 동작 분기

### 4-1. 클릭 시간 기준

```
클릭 지속 시간 < 300ms  → 빠른 클릭 (quick click)
클릭 지속 시간 ≥ 300ms  → 홀드 클릭 (hold click) → 명령 선택 UI 표시
```

### 4-2. 대상별 명령 수에 따른 동작

| 대상의 명령 수 | 빠른 클릭 | 홀드 클릭 |
|---------------|-----------|-----------|
| **1개** | 즉시 실행 | 선택 UI 표시 불필요, 즉시 실행 |
| **2개 이상** | 첫 번째(맨 위) 명령 즉시 실행 | 명령 선택 UI 표시 |

### 4-3. 대상별 명령 목록 및 우선순위

| 대상 | 1순위 (기본) | 2순위 |
|------|-------------|-------|
| 빈 흙 타일 | 이동 | — |
| 물 타일 | 이동 | 낚시하기 |
| 암반 타일 | 채굴하기 | — |
| 나무 오브젝트 | 벌목하기 | — |
| 작업대 | 제작하기 | — |
| 조리대 | 요리하기 | — |
| 침대 | 수면하기 | — |
| 선반 | 열기 | — |
| 동물 / 적군 | 공격하기 | — |

> 현재는 물 타일만 2개 명령이지만,
> 추후 콘텐츠 추가 시 확장 가능한 구조로 구현.

---

## 5. 홀드 클릭 명령 선택 UI

### 5-1. 표시 방식

```
홀드 300ms 경과 →
클릭 위치 근처에 명령 목록 팝업 표시 (수직 리스트)

┌─────────────────┐
│ 🏃 이동         │  ← 기본 포커스 (커서 위치 기준 하이라이트)
│ 🎣 낚시하기     │
└─────────────────┘

위치: 클릭 지점 우측 상단 (화면 끝에 걸리면 반대편으로 자동 전환)
```

### 5-2. 커서 이동으로 선택

- 팝업 표시 후 마우스 버튼을 **누른 채로** 커서를 움직임
- 커서가 각 명령 항목 위에 올라가면 해당 항목 **하이라이트**
- 아무 항목에도 커서가 없으면 첫 번째 항목 하이라이트 유지

```
[마우스 버튼 누른 상태]
        │
        ├── 커서를 팝업 항목 위로 이동
        │       → 해당 항목 하이라이트 (배경 밝아짐, 텍스트 흰색)
        │
        └── 마우스 버튼 놓음 (key up)
                → 현재 하이라이트된 명령 실행
                → 팝업 닫힘
```

### 5-3. 취소

| 동작 | 결과 |
|------|------|
| `ESC` 키 | 팝업 닫힘, 아무것도 실행하지 않음 |
| 마우스 우클릭 | 팝업 닫힘, 취소 |
| 팝업 영역 밖에서 버튼 놓음 | 첫 번째(기본) 명령 실행 |

### 5-4. Shift + 홀드 클릭

Shift를 누른 상태에서 홀드 클릭도 동일하게 동작.
key up 시 선택된 명령이 **큐에 추가**됨 (즉시 실행 아님).

---

## 6. 구현 구조

### 입력 처리 흐름

```typescript
onPointerDown(tile, target) {
  holdTimer = 0;
  holdTarget = target;
  isHolding = true;
}

onPointerUpdate(delta) {
  if (!isHolding) return;
  holdTimer += delta;

  if (holdTimer >= 300 && !commandPickerVisible) {
    const commands = getAvailableCommands(holdTarget);
    if (commands.length >= 2) showCommandPicker(commands);
  }
}

onPointerUp() {
  isHolding = false;

  if (commandPickerVisible) {
    const selected = getFocusedCommand();  // 하이라이트된 명령
    executeOrEnqueue(selected);
    hideCommandPicker();
  } else {
    // 빠른 클릭: 첫 번째 명령 실행
    const commands = getAvailableCommands(holdTarget);
    executeOrEnqueue(commands[0]);
  }
  holdTimer = 0;
}
```

### 대상별 명령 정의

```typescript
// src/systems/InteractionSystem.ts

function getAvailableCommands(target: InteractionTarget): Command[] {
  switch (target.type) {
    case 'tile_dirt':   return [CMD.MOVE(target.pos)];
    case 'tile_water':  return [CMD.MOVE(target.pos), CMD.FISH(target.pos)];
    case 'tile_rock':   return [CMD.MINE(target)];
    case 'obj_tree':    return [CMD.CHOP(target)];
    case 'workbench':   return [CMD.CRAFT(target)];
    case 'kitchen':     return [CMD.COOK(target)];
    case 'bed':         return [CMD.SLEEP(target)];
    case 'shelf':       return [CMD.OPEN_SHELF(target)];
    case 'animal':
    case 'enemy':       return [CMD.ATTACK(target)];
    default:            return [];
  }
}
```

---

## 7. 호버 툴팁 변경

기존 호버 시 단순 툴팁에서, 클릭 가능한 명령 수를 암시하는 표현 추가.

```
명령 1개:  "🪓 벌목하기"
명령 2개:  "🏃 이동  /  🎣 낚시하기  (꾹 눌러서 선택)"
```
