# 설계 02b — 스프라이트 확정 레퍼런스

> **목적**: `sprite-generator.html`에서 생성된 스프라이트가 최종 확정되었다.
> 이 문서는 Phaser 등록 키, 크기, 용도를 정리한 참조 문서다.
> 코드에서 스프라이트를 사용할 때 이 문서의 키 이름을 기준으로 한다.

---

## 스프라이트 생성 방식

- **외부 PNG 파일 없음**
- 모든 스프라이트는 `sprite-generator.html`의 Canvas 드로잉 함수 기반
- Phaser `preload()` 에서 동일한 드로잉 로직으로 `RenderTexture` 생성 후 키로 등록

---

## 전체 스프라이트 목록

### 타일 (32×32)

| Phaser 키 | 함수 | 설명 | 사용 위치 |
|-----------|------|------|-----------|
| `tile_dirt` | `drawDirt()` | 갈색 흙, 노이즈 질감 | 맵 타일 |
| `tile_water` | `drawWater()` | 파란 물, 반짝임 | 맵 타일 |
| `tile_rock` | `drawRock()` | 회색 암반, 균열 | 맵 타일 |

### 오브젝트 (32×48)

| Phaser 키 | 함수 | 크기 | 설명 | 사용 위치 |
|-----------|------|------|------|-----------|
| `obj_tree` | `drawTree()` | 32×48 | 그림자+줄기+잎 3레이어 | 맵 오브젝트 |

### 캐릭터 (32×32)

| Phaser 키 | 함수 | 설명 | 사용 위치 |
|-----------|------|------|-----------|
| `char_down` | `drawCharacter('down')` | 캐릭터 정면 | 플레이어 스프라이트 |
| `char_up` | `drawCharacter('up')` | 캐릭터 뒤 | 플레이어 스프라이트 |
| `char_left` | `drawCharacter('left')` | 캐릭터 좌 | 플레이어 스프라이트 |
| `char_right` | `drawCharacter('right')` | 캐릭터 우 (좌 반전) | 플레이어 스프라이트 |

### 아이템 아이콘 (32×32)

| Phaser 키 | 함수 | 설명 | 획득 방법 |
|-----------|------|------|-----------|
| `item_stone` | `drawStoneItem()` | 불규칙 회색 돌덩어리 | 암반 채굴 |
| `item_processed_stone` | `drawProcessedStone()` | 정돈된 석재 블록 | 작업대 가공 |
| `item_wood` | `drawWoodItem()` | 나무 판자 묶음 | 나무 벌목 |
| `item_fish` | `drawFish()` | 주황 물고기 | 낚시 성공 |
| `item_cooked_fish` | `drawCookedFish()` | 접시 위 구운 생선 | 조리대 요리 |

### 구조물 — 목재 (32×32)

| Phaser 키 | 함수 | 설명 | 내구도 |
|-----------|------|------|--------|
| `struct_wall_wood` | `drawWall(PAL.wood)` | 목재 벽 | 100 |
| `struct_door_wood` | `drawDoor(PAL.wood)` | 목재 문 | 80 |
| `struct_roof_wood` | `drawRoof(PAL.wood)` | 목재 지붕, 대각 패턴 | 120 |
| `struct_bed_wood` | `drawBed(PAL.wood)` | 목재 침대, 베개+이불 | 60 |
| `struct_table_wood` | `drawTableFurniture(PAL.wood)` | 목재 식탁 | 60 |
| `struct_chair_wood` | `drawChair(PAL.wood)` | 목재 의자 | 40 |
| `struct_workbench_wood` | `drawWorkbench(PAL.wood)` | 목재 작업대, 공구 표시 | 80 |
| `struct_kitchen_wood` | `drawKitchen(PAL.wood)` | 목재 조리대, 냄비+불 | 80 |

### 구조물 — 석재 (32×32)

| Phaser 키 | 함수 | 설명 | 내구도 |
|-----------|------|------|--------|
| `struct_wall_stone` | `drawWall(PAL.stone, 'brick')` | 석재 벽, 벽돌 패턴 | 300 |
| `struct_door_stone` | `drawDoor(PAL.stone)` | 석재 문 | 240 |
| `struct_roof_stone` | `drawRoof(PAL.stone)` | 석재 지붕 | 360 |
| `struct_bed_stone` | `drawBed(PAL.stone)` | 석재 침대 | 180 |
| `struct_table_stone` | `drawTableFurniture(PAL.stone)` | 석재 식탁 | 180 |
| `struct_chair_stone` | `drawChair(PAL.stone)` | 석재 의자 | 120 |
| `struct_workbench_stone` | `drawWorkbench(PAL.stone)` | 석재 작업대 | 240 |
| `struct_kitchen_stone` | `drawKitchen(PAL.stone)` | 석재 조리대 | 240 |

---

## Phaser preload() 등록 예시

```typescript
// TextureGenerator 클래스로 분리 권장
class TextureGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generateAll() {
    // 타일
    this.createTexture('tile_dirt',  (ctx) => drawDirt(ctx));
    this.createTexture('tile_water', (ctx) => drawWater(ctx));
    this.createTexture('tile_rock',  (ctx) => drawRock(ctx));

    // 오브젝트
    this.createTexture('obj_tree', (ctx) => drawTree(ctx), 32, 48);

    // 캐릭터
    ['down','up','left','right'].forEach(dir =>
      this.createTexture(`char_${dir}`, (ctx) => drawCharacter(ctx, dir))
    );

    // 아이템
    this.createTexture('item_stone',           (ctx) => drawStoneItem(ctx));
    this.createTexture('item_processed_stone', (ctx) => drawProcessedStone(ctx));
    this.createTexture('item_wood',            (ctx) => drawWoodItem(ctx));
    this.createTexture('item_fish',            (ctx) => drawFish(ctx));
    this.createTexture('item_cooked_fish',     (ctx) => drawCookedFish(ctx));

    // 구조물 — 목재
    const structs = ['wall','door','roof','bed','table','chair','workbench','kitchen'];
    structs.forEach(name => {
      this.createTexture(`struct_${name}_wood`,  (ctx) => drawStruct(ctx, name, 'wood'));
      this.createTexture(`struct_${name}_stone`, (ctx) => drawStruct(ctx, name, 'stone'));
    });
  }

  private createTexture(
    key: string,
    drawFn: (ctx: CanvasRenderingContext2D) => void,
    w = 32, h = 32
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    drawFn(canvas.getContext('2d')!);
    this.scene.textures.addCanvas(key, canvas);
  }
}
```

---

## 색상 팔레트 (코드 공유용)

```typescript
export const PALETTE = {
  wood:  { dark: '#a0622a', mid: '#c8884a', light: '#e0aa6a' },
  stone: { dark: '#5a5a5a', mid: '#909090', light: '#c0c0c0' },
};
```

---

## 참고

- 스프라이트 시각 확인: `sprite-generator.html` 브라우저에서 열기
- 각 스프라이트 PNG 내보내기: 각 카드의 "저장 PNG" 버튼 사용
- 향후 실제 픽셀아트로 교체 시: Phaser 키 이름 유지, 드로잉 함수만 교체
