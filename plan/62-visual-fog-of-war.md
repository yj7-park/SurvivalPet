# Plan 62 — 맵 탐험 안개 비주얼 (Visual Fog of War)

## 개요

플레이어가 탐험하지 않은 월드 영역을 어두운 안개로 덮고,  
탐험 시 부드럽게 걷어내는 Fog of War 시스템의 시각 표현을 설계한다.  
plan 43(미니맵 unexplored=black)과 연동하여 인게임·미니맵을 동기화한다.

---

## 1. 설계 방침

- **RenderTexture 마스크 방식**: 화면 크기 RenderTexture에 검정을 채우고 탐험한 위치에 투명 원을 erase
- **소프트 엣지**: 단순 원이 아닌 방사형 그라디언트 erase로 경계 부드럽게 처리
- **타일 단위 탐험 상태**: 각 타일 좌표의 visited 여부를 `Set<string>`으로 관리
- **세계 좌표 고정**: 카메라 스크롤에 따라 RT 위치 조정 (scrollFactor 1)
- **다중 레이어**: 짙은 미탐험(alpha 0.92) + 탐험했지만 시야 밖(alpha 0.45) 2단계

---

## 2. 데이터 구조

```typescript
class FogOfWarSystem {
  // 탐험 완료 타일 (영구)
  private visitedTiles = new Set<string>();   // "tx,ty"

  // 현재 시야 범위 내 타일 (이번 프레임)
  private visibleTiles = new Set<string>();

  // 탐험 반경 (타일 수)
  private readonly EXPLORE_RADIUS = 5;        // 160px
  private readonly VISIBLE_RADIUS = 4;        // 128px

  markVisible(playerTX: number, playerTY: number): void {
    this.visibleTiles.clear();
    for (let dy = -this.EXPLORE_RADIUS; dy <= this.EXPLORE_RADIUS; dy++) {
      for (let dx = -this.EXPLORE_RADIUS; dx <= this.EXPLORE_RADIUS; dx++) {
        if (dx*dx + dy*dy <= this.EXPLORE_RADIUS * this.EXPLORE_RADIUS) {
          const key = `${playerTX + dx},${playerTY + dy}`;
          this.visitedTiles.add(key);
          if (dx*dx + dy*dy <= this.VISIBLE_RADIUS * this.VISIBLE_RADIUS) {
            this.visibleTiles.add(key);
          }
        }
      }
    }
  }

  isVisited(tx: number, ty: number): boolean {
    return this.visitedTiles.has(`${tx},${ty}`);
  }

  isVisible(tx: number, ty: number): boolean {
    return this.visibleTiles.has(`${tx},${ty}`);
  }
}
```

---

## 3. 안개 레이어 렌더링 (`FogLayer`)

### 3-1. 2단계 안개 RenderTexture

```typescript
class FogLayer {
  // 미탐험: 짙은 검정 (alpha 0.92)
  private darkFog: Phaser.GameObjects.RenderTexture;
  // 탐험했지만 시야 밖: 회색빛 오버레이 (alpha 0.45)
  private dimFog:  Phaser.GameObjects.RenderTexture;

  private readonly TILE  = 32;
  private readonly CAM_W: number;
  private readonly CAM_H: number;
  // RT 크기: 카메라보다 2타일 여유
  private readonly RT_W:  number;
  private readonly RT_H:  number;

  constructor(scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    this.CAM_W = cam.width;
    this.CAM_H = cam.height;
    this.RT_W  = cam.width  + this.TILE * 4;
    this.RT_H  = cam.height + this.TILE * 4;

    this.darkFog = scene.add.renderTexture(0, 0, this.RT_W, this.RT_H)
      .setDepth(60)      // 캐릭터·오브젝트 위, 파티클 아래
      .setScrollFactor(0);

    this.dimFog = scene.add.renderTexture(0, 0, this.RT_W, this.RT_H)
      .setDepth(59)
      .setScrollFactor(0);
  }

  update(
    fog: FogOfWarSystem,
    cam: Phaser.Cameras.Scene2D.Camera
  ): void {
    // 카메라 오프셋 (왼쪽 위 타일 좌표)
    const startTX = Math.floor(cam.scrollX / this.TILE) - 2;
    const startTY = Math.floor(cam.scrollY / this.TILE) - 2;
    const endTX   = startTX + Math.ceil(this.RT_W  / this.TILE) + 4;
    const endTY   = startTY + Math.ceil(this.RT_H / this.TILE) + 4;

    // --- 짙은 안개 (미탐험) ---
    this.darkFog.clear();
    const darkGfx = scene.make.graphics({ add: false });
    darkGfx.fillStyle(0x000000, 1.0);
    darkGfx.fillRect(0, 0, this.RT_W, this.RT_H);
    this.darkFog.draw(darkGfx, 0, 0);
    darkGfx.destroy();
    this.darkFog.setAlpha(0.92);

    // 탐험한 타일 영역을 ERASE
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (fog.isVisited(tx, ty)) {
          const sx = (tx - startTX) * this.TILE;
          const sy = (ty - startTY) * this.TILE;
          this.eraseCircleGradient(this.darkFog, sx + 16, sy + 16, this.TILE * 1.5);
        }
      }
    }

    // --- 흐린 안개 (탐험했지만 시야 밖) ---
    this.dimFog.clear();
    const dimGfx = scene.make.graphics({ add: false });
    dimGfx.fillStyle(0x000000, 1.0);
    dimGfx.fillRect(0, 0, this.RT_W, this.RT_H);
    this.dimFog.draw(dimGfx, 0, 0);
    dimGfx.destroy();
    this.dimFog.setAlpha(0.45);

    // 현재 시야 내 타일도 ERASE
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (fog.isVisible(tx, ty)) {
          const sx = (tx - startTX) * this.TILE;
          const sy = (ty - startTY) * this.TILE;
          this.eraseCircleGradient(this.dimFog, sx + 16, sy + 16, this.TILE * 2.0);
        }
      }
    }

    // RT 위치를 카메라 스크롤에 맞춤
    const offsetX = -(cam.scrollX % this.TILE) - this.TILE * 2;
    const offsetY = -(cam.scrollY % this.TILE) - this.TILE * 2;
    this.darkFog.setPosition(offsetX, offsetY);
    this.dimFog.setPosition(offsetX, offsetY);
  }

  // 방사형 그라디언트 erase (3단계 근사)
  private eraseCircleGradient(
    rt: Phaser.GameObjects.RenderTexture,
    cx: number, cy: number, r: number
  ): void {
    const gfx = scene.make.graphics({ add: false });
    // 중심 완전 지움
    gfx.fillStyle(0x000000, 1.0);
    gfx.fillCircle(cx, cy, r * 0.5);
    // 중간 부분
    gfx.fillStyle(0x000000, 0.75);
    gfx.fillCircle(cx, cy, r * 0.75);
    // 외곽 흐림
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillCircle(cx, cy, r);
    rt.erase(gfx, 0, 0);
    gfx.destroy();
  }
}
```

---

## 4. 안개 색상 (시간대·날씨 보정)

```typescript
const FOG_TINTS: Record<string, { dark: number; dim: number }> = {
  day:     { dark: 0x000000, dim: 0x101018 },
  evening: { dark: 0x100808, dim: 0x180c0c },  // 저녁: 붉은기
  night:   { dark: 0x000010, dim: 0x08080c },  // 밤: 파란기
  dawn:    { dark: 0x080810, dim: 0x100c10 },  // 새벽: 보라기
};

// 계절별 안개 투명도 보정
const FOG_ALPHA_SEASON: Record<Season, number> = {
  spring: 0.92,
  summer: 0.90,
  autumn: 0.88,   // 가을: 약간 밝게 (낙엽 느낌)
  winter: 0.95,   // 겨울: 더 짙게
};
```

---

## 5. 탐험 확장 이펙트 (`FogRevealEffect`)

새로운 타일이 처음 탐험될 때 부드럽게 안개가 걷히는 효과.

```typescript
class FogRevealEffect {
  private pendingReveal: Set<string> = new Set();

  onNewTileRevealed(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    if (this.pendingReveal.has(key)) return;
    this.pendingReveal.add(key);

    const wx = tx * 32 + 16;
    const wy = ty * 32 + 16;

    // 소형 흰빛 반짝임 (새 영역 발견 느낌)
    const gfx = scene.add.graphics().setDepth(61);
    scene.tweens.add({
      targets: { r: 4, a: 0.4 }, r: 24, a: 0,
      duration: 400, ease: 'Quad.easeOut',
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.fillStyle(0xffffff, obj.a * 0.3);
        gfx.fillCircle(wx, wy, obj.r);
      },
      onComplete: () => {
        gfx.destroy();
        this.pendingReveal.delete(key);
      }
    });
  }
}
```

---

## 6. 특수 지역 안개 스타일

```typescript
// 동굴/지하 미탐험: 순수 검정 (그라디언트 없음)
// 실외 미탐험: 기본 안개
// 실내 진입 시: 안개 일시 투명화 (setAlpha 0)
function onEnterIndoor(): void {
  scene.tweens.add({
    targets: [fogLayer.darkFog, fogLayer.dimFog],
    alpha: 0, duration: 300
  });
}

function onExitIndoor(): void {
  scene.tweens.add({
    targets: fogLayer.darkFog, alpha: 0.92, duration: 300
  });
  scene.tweens.add({
    targets: fogLayer.dimFog, alpha: 0.45, duration: 300
  });
}
```

---

## 7. 미니맵 동기화 (plan 43 확장)

```typescript
// plan 43 MiniMap 렌더링에서 unexplored 타일 처리 방식 통일
function drawMinimapTile(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  fog: FogOfWarSystem,
  terrain: TerrainType,
  mx: number, my: number, tileSize: number
): void {
  if (!fog.isVisited(tx, ty)) {
    ctx.fillStyle = '#000000';            // 완전 미탐험: 검정
  } else if (!fog.isVisible(tx, ty)) {
    ctx.fillStyle = dimTerrainColor(terrain);  // 탐험했지만 시야 밖: 어두운 색
  } else {
    ctx.fillStyle = MINIMAP_COLORS[terrain];   // 현재 시야: 정상 색
  }
  ctx.fillRect(mx, my, tileSize, tileSize);
}

function dimTerrainColor(terrain: TerrainType): string {
  // plan 43 MINIMAP_COLORS 값에서 명도 50% 감소
  const base = MINIMAP_COLORS[terrain];
  // hex → RGB → 절반 밝기 → hex
  return darken(base, 0.5);
}
```

---

## 8. 성능 최적화

```typescript
// 매 프레임 전체 RT 재작성은 비용이 큼 → dirty flag 방식
class FogLayer {
  private dirty = true;
  private lastPlayerTX = -1;
  private lastPlayerTY = -1;

  updateIfNeeded(
    playerTX: number, playerTY: number,
    fog: FogOfWarSystem, cam: Phaser.Cameras.Scene2D.Camera
  ): void {
    // 플레이어가 타일 이동했을 때만 재렌더링
    if (playerTX === this.lastPlayerTX && playerTY === this.lastPlayerTY
        && !this.dirty) {
      // 카메라 스크롤 위치만 업데이트
      this.syncPosition(cam);
      return;
    }
    this.lastPlayerTX = playerTX;
    this.lastPlayerTY = playerTY;
    this.dirty = false;
    this.update(fog, cam);
  }
}
```

---

## 9. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 탐험 했지만 시야 밖 흐린 안개 | 59 |
| 미탐험 짙은 안개 | 60 |
| 신규 탐험 반짝임 | 61 |
| (참고) DarknessLayer (plan 32) | 50 |
| (참고) 캐릭터 | ~35 |
| (참고) 파티클 | ~55 |

---

## 10. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/FogOfWarSystem.ts` | visited/visible 타일 관리, markVisible |
| `src/systems/FogLayer.ts` | RenderTexture 렌더링, 그라디언트 erase, 위치 동기화 |
| `src/systems/FogRevealEffect.ts` | 신규 탐험 반짝임 |
| `src/ui/MiniMap.ts` | plan 43 확장 — FogOfWar 연동 |

---

## 11. 버전

`v0.62.0`
