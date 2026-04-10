# 설계 47 — 아이템 아이콘 비주얼

> **전제 조건**: 01~46 단계 완료 상태.
> plan 07(인벤토리), plan 13(요리), plan 15(방어구),
> plan 39(농업), plan 43(인벤토리 슬롯 외형)을 기반으로
> 게임 내 모든 아이템의 16×16px 아이콘 드로잉을 확정한다.

---

## 1. 이번 단계 목표

1. **자원 아이템** — 목재·암석·석재·물고기 등 기반 자원 아이콘
2. **무기·방어구** — 5종 무기, 4종 갑옷, 2종 방패 아이콘
3. **음식 아이템** — 날것·조리 음식 6종 + 농작물 4종
4. **도구 아이템** — 괭이·물뿌리개·횃불 등
5. **아이템 드랍 지면 렌더** — 월드에 떨어진 아이템 시각화
6. **아이콘 품질 등급** — 희귀도별 테두리 색상 시스템

---

## 2. 아이콘 드로잉 시스템

### 2-1. 공통 규격

```typescript
// 모든 아이템 아이콘: 16×16px Canvas
// 배경: 투명 (슬롯 배경색이 비침)
// 외곽선: 1px 어두운 색 (아이콘 가독성)
// 스타일: 픽셀아트 느낌 (안티앨리어싱 없음)

const ITEM_ICON_SIZE = 16;

function drawItemIcon(key: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ITEM_ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;   // 픽셀 선명하게
  ICON_DRAWERS[key](ctx);
  return canvas;
}
```

### 2-2. 희귀도 등급 테두리

```typescript
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

const RARITY_BORDER: Record<ItemRarity, number> = {
  common:   0x3a2a14,   // 기본 갈색 (plan 43 slotBorder)
  uncommon: 0x2a6a2a,   // 녹색
  rare:     0x2a3a8a,   // 파랑
  epic:     0x6a2a8a,   // 보라
};

// 슬롯 테두리 색상을 희귀도에 따라 교체
// 희귀 이상 아이템: 슬롯 모서리 4px 빛 글로우 (blendMode ADD, alpha 0.4)
```

---

## 3. 자원 아이템 아이콘

```typescript
const RESOURCE_ICONS: Record<string, IconDrawer> = {

  // 목재 (item_wood): 갈색 원통형 통나무 3개 묶음
  item_wood: (ctx) => {
    const c = '#c8884a';
    // 통나무 3개 (원형 단면 + 옆면)
    [[3,10],[8,8],[13,10]].forEach(([x,y]) => {
      ctx.fillStyle = '#8b5e2a'; ctx.fillEllipse?.(x,y,4,3);
      // ellipse 미지원 시 rect 근사
      ctx.fillStyle = c; ctx.fillRect(x-2, y-5, 4, 5);
      ctx.fillStyle = '#6a4420'; ctx.fillRect(x-2, y-5, 1, 5);
    });
    // 묶는 끈
    ctx.fillStyle = '#5a3a10'; ctx.fillRect(5, 6, 6, 1);
  },

  // 암석 (item_stone): 회색 불규칙 다각형 2개
  item_stone: (ctx) => {
    ctx.fillStyle = '#909090';
    ctx.beginPath();
    ctx.moveTo(2,12); ctx.lineTo(4,6); ctx.lineTo(9,4);
    ctx.lineTo(13,7); ctx.lineTo(12,13); ctx.lineTo(6,14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b0b0b0';  // 하이라이트
    ctx.beginPath();
    ctx.moveTo(5,7); ctx.lineTo(8,5); ctx.lineTo(10,8); ctx.lineTo(7,9);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#606060'; ctx.lineWidth = 1; ctx.stroke();
  },

  // 석재 (item_processed_stone): 정돈된 회색 벽돌
  item_processed_stone: (ctx) => {
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(2, 4, 12, 8);
    ctx.fillStyle = '#808080';
    ctx.fillRect(2, 8, 12, 1);   // 수평 줄눈
    ctx.fillRect(7, 4, 1, 4);    // 수직 줄눈 위
    ctx.fillRect(4, 9, 1, 3);    // 수직 줄눈 아래
    ctx.strokeStyle = '#606060'; ctx.lineWidth = 1;
    ctx.strokeRect(2, 4, 12, 8);
    // 상단 하이라이트
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(3, 5, 10, 1);
  },

  // 물고기 (item_fish): 파란빛 물고기 측면
  item_fish: (ctx) => {
    ctx.fillStyle = '#4a9adc';
    // 몸통 타원
    ctx.beginPath();
    ctx.ellipse(8, 9, 5, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // 꼬리 지느러미
    ctx.fillStyle = '#3a7ab8';
    ctx.beginPath();
    ctx.moveTo(12,9); ctx.lineTo(15,6); ctx.lineTo(15,12); ctx.closePath();
    ctx.fill();
    // 눈
    ctx.fillStyle = '#000000'; ctx.beginPath();
    ctx.arc(5, 8, 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath();
    ctx.arc(5, 8, 0.4, 0, Math.PI * 2); ctx.fill();
    // 비늘 (흰 반원 2개)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(7, 9, 2, 0.5, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(10, 9, 1.5, 0.5, Math.PI); ctx.stroke();
  },
};
```

---

## 4. 음식 아이템 아이콘

```typescript
const FOOD_ICONS = {

  // 날고기 (item_raw_meat): 붉은 고기 덩어리
  item_raw_meat: (ctx) => {
    ctx.fillStyle = '#cc4444';
    ctx.beginPath();
    ctx.moveTo(3,6); ctx.lineTo(7,3); ctx.lineTo(13,5);
    ctx.lineTo(14,11); ctx.lineTo(9,14); ctx.lineTo(3,12);
    ctx.closePath(); ctx.fill();
    // 지방 마블링 (흰 줄)
    ctx.strokeStyle = 'rgba(255,220,200,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(5,7); ctx.lineTo(10,6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,10); ctx.lineTo(11,9); ctx.stroke();
    ctx.strokeStyle = '#aa2222'; ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, 11, 11);
  },

  // 구운 고기 (item_cooked_meat): 갈색, 그릴 자국
  item_cooked_meat: (ctx) => {
    ctx.fillStyle = '#8b4a18';
    ctx.beginPath();
    ctx.moveTo(3,6); ctx.lineTo(7,3); ctx.lineTo(13,5);
    ctx.lineTo(14,11); ctx.lineTo(9,14); ctx.lineTo(3,12);
    ctx.closePath(); ctx.fill();
    // 그릴 자국 (어두운 사선)
    ctx.strokeStyle = '#5a2a08'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(5,5); ctx.lineTo(8,11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8,4); ctx.lineTo(11,10); ctx.stroke();
    // 윤기 (흰 하이라이트)
    ctx.fillStyle = 'rgba(255,200,100,0.3)';
    ctx.fillRect(4, 4, 4, 2);
  },

  // 구운 생선 (item_cooked_fish): 노릇한 생선
  item_cooked_fish: (ctx) => {
    ctx.fillStyle = '#c87828';
    ctx.beginPath();
    ctx.ellipse(8, 9, 5, 3, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e09840';
    ctx.beginPath();
    ctx.ellipse(7, 8, 3, 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3010';
    ctx.beginPath();
    ctx.moveTo(12,9); ctx.lineTo(15,6); ctx.lineTo(15,12); ctx.closePath(); ctx.fill();
    // 눈
    ctx.fillStyle = '#ffffff'; ctx.beginPath();
    ctx.arc(5, 8, 0.8, 0, Math.PI * 2); ctx.fill();
  },

  // 생선 스튜 (item_fish_stew): 갈색 그릇 + 국물
  item_fish_stew: (ctx) => {
    // 그릇 (갈색 원)
    ctx.fillStyle = '#8b5e2a';
    ctx.beginPath(); ctx.arc(8, 10, 6, 0, Math.PI * 2); ctx.fill();
    // 국물 (주황 반원)
    ctx.fillStyle = '#d08030';
    ctx.beginPath(); ctx.arc(8, 10, 5, Math.PI, 0); ctx.fill();
    // 재료 (작은 점: 흰 생선, 주황 당근)
    ctx.fillStyle = '#ffffffcc';
    ctx.fillRect(6, 8, 2, 1); ctx.fillRect(9, 9, 1, 1);
    ctx.fillStyle = '#ff8820';
    ctx.fillRect(7, 10, 1, 1); ctx.fillRect(10, 8, 1, 1);
    // 그릇 테두리 + 손잡이
    ctx.strokeStyle = '#5a3010'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(8, 10, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8b5e2a';
    ctx.fillRect(2, 9, 2, 2); ctx.fillRect(12, 9, 2, 2);
  },
};
```

---

## 5. 무기·방어구 아이콘

```typescript
const EQUIPMENT_ICONS = {

  // 나무칼 (item_sword_wood): 갈색 날 + 손잡이
  item_sword_wood: (ctx) => {
    // 손잡이
    ctx.fillStyle = '#8b5020'; ctx.fillRect(2, 11, 4, 4);
    ctx.fillStyle = '#6a3a10'; ctx.fillRect(2, 11, 1, 4);
    // 가드 (십자)
    ctx.fillStyle = '#5a3010'; ctx.fillRect(1, 10, 6, 2);
    // 날 (뾰족)
    ctx.fillStyle = '#c89060';
    ctx.beginPath();
    ctx.moveTo(4,10); ctx.lineTo(4,3); ctx.lineTo(6,3); ctx.lineTo(6,10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4,3); ctx.lineTo(5,1); ctx.lineTo(6,3);
    ctx.closePath(); ctx.fill();
    // 날 하이라이트
    ctx.fillStyle = '#e0b080'; ctx.fillRect(5, 3, 1, 7);
  },

  // 철제칼 (item_sword_iron): 밝은 금속 날
  item_sword_iron: (ctx) => {
    ctx.fillStyle = '#606060'; ctx.fillRect(2, 11, 4, 4);
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(1, 10, 6, 2);
    ctx.fillStyle = '#c0c0c8';
    ctx.beginPath();
    ctx.moveTo(4,10); ctx.lineTo(4,2); ctx.lineTo(6,2); ctx.lineTo(6,10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4,2); ctx.lineTo(5,0); ctx.lineTo(6,2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e8f0'; ctx.fillRect(5, 2, 1, 8);
    ctx.fillStyle = '#ffd060'; ctx.fillRect(3, 11, 2, 1); // 금 장식
  },

  // 활 (item_bow): 갈색 곡선 + 시위
  item_bow: (ctx) => {
    ctx.strokeStyle = '#8b5e2a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 2); ctx.quadraticCurveTo(12, 8, 4, 14);
    ctx.stroke();
    ctx.strokeStyle = '#f0d0a0'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(4, 14); ctx.stroke();
    // 화살 장전 표시 (가는 선)
    ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(13, 8); ctx.stroke();
  },

  // 가죽 갑옷 (item_armor_leather): 갈색 조끼 실루엣
  item_armor_leather: (ctx) => {
    ctx.fillStyle = '#7a5030';
    // 조끼 몸통
    ctx.beginPath();
    ctx.moveTo(4,3); ctx.lineTo(12,3); ctx.lineTo(13,13);
    ctx.lineTo(11,15); ctx.lineTo(5,15); ctx.lineTo(3,13);
    ctx.closePath(); ctx.fill();
    // 어깨
    ctx.fillStyle = '#6a3a20';
    ctx.fillRect(2,3,3,4); ctx.fillRect(11,3,3,4);
    // 버클
    ctx.fillStyle = '#c0a030';
    ctx.fillRect(7,7,2,2);
    // 재봉선
    ctx.strokeStyle = '#5a2a10'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(8,3); ctx.lineTo(8,14); ctx.stroke();
  },

  // 철제 갑옷 (item_armor_iron): 금속 플레이트
  item_armor_iron: (ctx) => {
    ctx.fillStyle = '#909098';
    ctx.beginPath();
    ctx.moveTo(3,3); ctx.lineTo(13,3); ctx.lineTo(14,13);
    ctx.lineTo(11,15); ctx.lineTo(5,15); ctx.lineTo(2,13);
    ctx.closePath(); ctx.fill();
    // 플레이트 라인
    ctx.strokeStyle = '#606068'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(3,8); ctx.lineTo(13,8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3,11); ctx.lineTo(13,11); ctx.stroke();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(4,4,4,3);
    // 리벳
    ctx.fillStyle = '#c0c0c8';
    [[4,9],[8,9],[12,9],[4,12],[12,12]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x,y,0.8,0,Math.PI*2); ctx.fill();
    });
  },
};
```

---

## 6. 도구 아이템 아이콘

```typescript
const TOOL_ICONS = {

  // 괭이 (item_hoe): L자형 도구
  item_hoe: (ctx) => {
    // 자루
    ctx.strokeStyle = '#a07040'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12,2); ctx.lineTo(4,14); ctx.stroke();
    // 날
    ctx.fillStyle = '#909090';
    ctx.beginPath();
    ctx.moveTo(10,2); ctx.lineTo(15,2); ctx.lineTo(15,5); ctx.lineTo(10,5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(10,2,5,1);
  },

  // 물뿌리개 (item_watering_can): 파란 물통 + 주둥이
  item_watering_can: (ctx) => {
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(3, 6, 8, 7);
    // 손잡이
    ctx.strokeStyle = '#3366aa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(5,6); ctx.arc(5,3,3,0.5*Math.PI,Math.PI*1.5); ctx.stroke();
    // 주둥이
    ctx.fillStyle = '#3366aa';
    ctx.fillRect(11, 8, 3, 2);
    ctx.fillStyle = '#88aadd'; ctx.fillRect(3,6,8,2); // 상단 하이라이트
    // 물방울
    ctx.fillStyle = '#aaccff';
    ctx.beginPath(); ctx.arc(14,11,1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(15,13,0.8,0,Math.PI*2); ctx.fill();
  },

  // 횃불 (item_torch): 나무 + 불꽃
  item_torch: (ctx) => {
    // 자루
    ctx.fillStyle = '#a07040'; ctx.fillRect(7,8,2,7);
    ctx.fillStyle = '#8b5e2a'; ctx.fillRect(7,8,1,7);
    // 천 감은 부분
    ctx.fillStyle = '#8b6040'; ctx.fillRect(6,6,4,3);
    // 불꽃 (3색 레이어)
    ctx.fillStyle = '#ff4400'; // 외부 (주황)
    ctx.beginPath(); ctx.moveTo(8,1); ctx.lineTo(5,7); ctx.lineTo(11,7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffaa00'; // 중간 (노랑)
    ctx.beginPath(); ctx.moveTo(8,2); ctx.lineTo(6,7); ctx.lineTo(10,7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffff88'; // 중심 (흰 노랑)
    ctx.beginPath(); ctx.moveTo(8,4); ctx.lineTo(7,7); ctx.lineTo(9,7); ctx.closePath(); ctx.fill();
  },
};
```

---

## 7. 농작물 아이콘

```typescript
const CROP_ICONS = {

  item_wheat: (ctx) => {
    ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8,14); ctx.lineTo(8,4); ctx.stroke();
    // 이삭 (좌우 교대)
    [[6,5],[10,6],[6,8],[10,9],[6,11]].forEach(([x,y],i) => {
      ctx.fillStyle = i%2===0?'#e8c040':'#d4a820';
      ctx.fillEllipse?.(x,y,3,2) ??
        ctx.fillRect(x-1.5,y-1,3,2);
    });
  },

  item_carrot: (ctx) => {
    ctx.fillStyle = '#f06820';
    ctx.beginPath();
    ctx.moveTo(8,4); ctx.lineTo(5,14); ctx.lineTo(11,14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d05010'; // 그늘
    ctx.beginPath();
    ctx.moveTo(8,4); ctx.lineTo(8,14); ctx.lineTo(11,14);
    ctx.closePath(); ctx.fill();
    // 잎
    ctx.fillStyle = '#40a020';
    ctx.beginPath(); ctx.moveTo(8,4); ctx.lineTo(5,1); ctx.lineTo(7,3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8,4); ctx.lineTo(11,1); ctx.lineTo(9,3); ctx.closePath(); ctx.fill();
  },

  item_potato: (ctx) => {
    ctx.fillStyle = '#c8a060';
    ctx.beginPath(); ctx.ellipse(8,9,5,4,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#a07840'; // 그늘
    ctx.beginPath(); ctx.ellipse(9,10,4,3,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#c8a060';
    ctx.beginPath(); ctx.ellipse(7,8,3,2.5,0.2,0,Math.PI*2); ctx.fill();
    // 눈(芽)
    ctx.fillStyle = '#5a3a10';
    [[5,7],[10,10]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x,y,0.8,0,Math.PI*2); ctx.fill();
    });
  },

  item_pumpkin: (ctx) => {
    // 호박 4개 세그먼트
    [[5,8],[8,7],[11,8],[8,10]].forEach(c => {
      ctx.fillStyle = '#e07820';
      ctx.beginPath(); ctx.ellipse(c[0],c[1],2.5,3.5,0,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle = '#c05e10';
    [5,8,11].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x,5); ctx.lineTo(x,13); ctx.stroke?.();
    });
    // 꼭지
    ctx.fillStyle = '#407020';
    ctx.fillRect(7,3,2,3);
  },
};
```

---

## 8. 지면 아이템 렌더 (월드)

### 8-1. 아이템 드랍 외형

```typescript
// 지면에 떨어진 아이템: 아이콘 × 0.9 스케일 + 그림자 + 호버 애니메이션
interface GroundItemSprite {
  icon:   Phaser.GameObjects.Image;    // 16×16 아이콘
  shadow: Phaser.GameObjects.Ellipse;  // 아래 그림자
  glow?:  Phaser.GameObjects.Graphics; // 희귀 아이템 글로우
}

function createGroundItemSprite(item: GroundItem): GroundItemSprite {
  const shadow = scene.add.ellipse(item.x, item.y + 6, 12, 4, 0x000000, 0.3);
  const icon   = scene.add.image(item.x, item.y, item.spriteKey).setScale(0.9);

  // 위아래 호버 (2초 주기)
  scene.tweens.add({
    targets: icon, y: item.y - 3,
    duration: 1000, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut',
    offset: Math.random() * 1000,  // 여러 아이템이 동시에 움직이지 않도록
  });
  shadow.setScale(1, 1);
  scene.tweens.add({
    targets: shadow, scaleX: 0.7,
    duration: 1000, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // 희귀 아이템 글로우 (uncommon 이상)
  let glow: Phaser.GameObjects.Graphics | undefined;
  if (item.rarity !== 'common') {
    glow = scene.add.graphics();
    glow.lineStyle(1, RARITY_BORDER[item.rarity], 0.7);
    glow.strokeCircle(item.x, item.y, 10);
    scene.tweens.add({
      targets: glow, alpha: { from: 0.2, to: 0.8 },
      duration: 800, yoyo: true, repeat: -1,
    });
  }
  return { icon, shadow, glow };
}
```

### 8-2. 픽업 범위 표시

플레이어가 아이템 48px 이내 접근 시:
```typescript
// 아이콘 아래 흰 점선 원 (픽업 가능 표시)
const pickupRing = scene.add.graphics();
pickupRing.lineStyle(1, 0xffffff, 0.4);
pickupRing.strokeCircle(item.x, item.y, 8);
// 0.4초 깜빡임
```

---

## 9. 전체 아이템 키 목록

| 카테고리 | 아이템 키 목록 |
|---------|-------------|
| 자원 | `item_wood`, `item_stone`, `item_processed_stone`, `item_fish` |
| 음식 | `item_raw_meat`, `item_cooked_meat`, `item_raw_fish`, `item_cooked_fish`, `item_fish_stew`, `item_meat_stew` |
| 농작물 | `item_wheat`, `item_carrot`, `item_potato`, `item_pumpkin`, `item_bread`, `item_carrot_stew`, `item_pumpkin_porridge`, `item_potato_soup` |
| 무기 | `item_sword_wood`, `item_sword_stone`, `item_sword_iron`, `item_bow`, `item_arrow` |
| 방어구 | `item_armor_leather`, `item_armor_wood`, `item_armor_stone`, `item_armor_iron` |
| 방패 | `item_shield_wood`, `item_shield_stone` |
| 도구 | `item_hoe`, `item_watering_can`, `item_torch` |
| 씨앗 | `item_seed_wheat`, `item_seed_carrot`, `item_seed_potato`, `item_seed_pumpkin` |
| 기타 | `item_blueprint`, `item_recipe` |

총 **34종** 아이콘

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/world/SpriteGenerator.ts` | 아이템 아이콘 34종 생성 로직 추가 |
| `src/config/items.ts` | 각 아이템에 `rarity` 필드 추가 |
| `src/rendering/GroundItemRenderer.ts` | 신규: 지면 아이템 호버·그림자·글로우 |
| `src/ui/InventoryPanel.ts` | 희귀도 테두리 색상 적용 |
| `src/systems/DropSystem.ts` | GroundItemRenderer 연결 |

---

## 11. 확정 규칙

- 모든 아이콘: 16×16px, `imageSmoothingEnabled = false` (픽셀 선명)
- 지면 호버 애니메이션: `offset` 랜덤화로 여러 아이템 동시 점프 방지
- 희귀도 글로우: common은 없음, uncommon 녹색, rare 파랑, epic 보라
- 픽업 범위 표시 링: 플레이어 기준 가장 가까운 아이템 1개에만 표시
- 도면(blueprint)·레시피 아이템 아이콘: 두루마리 모양 (갈색 배경 + 흰 선)
- 화살(item_arrow): 스택 아이콘이므로 수량 최대 99 표시
