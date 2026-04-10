# Plan 82 — 미니맵·레이더 비주얼 개선

## 목표
미니맵 UI를 RenderTexture 기반으로 재구현하고, 플레이어·NPC·적·퀘스트
마커 아이콘, 탐색 안개, 축척 표시, 레이더 스캔 이펙트를 추가한다.

## 버전
`v0.82.0`

## 대상 파일
- `src/ui/MiniMapRenderer.ts` (신규, 기존 MiniMapPanel.ts 대체)
- `src/ui/MapMarker.ts` (신규)

---

## 1. 설정 상수

```typescript
// src/ui/MiniMapRenderer.ts

const MM = {
  SIZE:         140,          // 미니맵 화면 크기 (px)
  MAP_TILES_W:  100,          // 실제 맵 타일 수 (X)
  MAP_TILES_H:  100,          // 실제 맵 타일 수 (Y)
  TILE_PX:      32,           // 타일 1개 픽셀 크기
  BG:           0x050510,
  BORDER:       0x4455aa,
  BORDER_W:     2,
  MARGIN_R:     16,
  MARGIN_T:     16,
  FOG_COLOR:    0x000000,
  FOG_ALPHA:    0.72,
  SCALE_LABEL:  '#666688',
} as const;

// 미니맵 픽셀 1개 = 세계 몇 타일
const TILE_PER_PIXEL = MM.MAP_TILES_W / MM.SIZE;  // 100/140 ≈ 0.71
```

---

## 2. MiniMapRenderer 클래스

```typescript
export class MiniMapRenderer {
  private scene: Phaser.Scene;
  private rt!: Phaser.GameObjects.RenderTexture;      // 지형 레이어
  private fogRt!: Phaser.GameObjects.RenderTexture;   // 탐색 안개 레이어
  private markerGfx!: Phaser.GameObjects.Graphics;    // 마커 레이어
  private frame!: Phaser.GameObjects.Graphics;        // 테두리/UI
  private container!: Phaser.GameObjects.Container;
  private gfxHelper: Phaser.GameObjects.Graphics;
  private fogRevealed: boolean[][] = [];
  private scanAngle = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfxHelper = scene.add.graphics().setVisible(false);
    this._initFog();
    this._build();
  }

  private _initFog(): void {
    this.fogRevealed = Array.from({ length: MM.MAP_TILES_H }, () =>
      new Array(MM.MAP_TILES_W).fill(false),
    );
  }

  private _build(): void {
    const { width: W } = this.scene.scale;
    const ox = W - MM.SIZE - MM.MARGIN_R;
    const oy = MM.MARGIN_T;

    // 지형 RenderTexture (전체 맵 → 축소)
    this.rt = this.scene.add.renderTexture(ox, oy, MM.SIZE, MM.SIZE)
      .setDepth(140).setScrollFactor(0);

    // 안개 RenderTexture
    this.fogRt = this.scene.add.renderTexture(ox, oy, MM.SIZE, MM.SIZE)
      .setDepth(141).setScrollFactor(0);
    this._drawFullFog();

    // 마커 Graphics
    this.markerGfx = this.scene.add.graphics()
      .setDepth(142).setScrollFactor(0).setPosition(ox, oy);

    // 테두리 + 스케일 바
    this.frame = this.scene.add.graphics().setDepth(143).setScrollFactor(0);
    this._drawFrame(ox, oy);

    this.container = this.scene.add.container(0, 0, [
      this.rt, this.fogRt, this.markerGfx, this.frame,
    ]).setScrollFactor(0).setDepth(140);
  }

  private _drawFrame(ox: number, oy: number): void {
    const S = MM.SIZE;
    this.frame.clear();

    // 외곽 테두리
    this.frame.lineStyle(MM.BORDER_W, MM.BORDER, 1)
      .strokeRect(ox - 1, oy - 1, S + 2, S + 2);

    // 모서리 장식 (L자형)
    const corners = [
      [ox - 1, oy - 1],
      [ox + S + 1, oy - 1],
      [ox - 1, oy + S + 1],
      [ox + S + 1, oy + S + 1],
    ] as [number, number][];
    const cLen = 8;
    corners.forEach(([cx, cy], idx) => {
      const dx = idx < 2 ? 1 : -1;
      const dy = idx % 2 === 0 ? 1 : -1;
      this.frame.lineStyle(2, 0x88aaff, 1)
        .strokeLineShape(new Phaser.Geom.Line(cx, cy, cx + dx * cLen, cy))
        .strokeLineShape(new Phaser.Geom.Line(cx, cy, cx, cy + dy * cLen));
    });

    // 스케일 바 (100 타일 = MM.SIZE px → 10타일 = MM.SIZE/10 px)
    const barPx = MM.SIZE / 10;
    this.frame.lineStyle(1, 0x556677, 1)
      .strokeLineShape(new Phaser.Geom.Line(ox + 4, oy + S - 6, ox + 4 + barPx, oy + S - 6));
    this.scene.add.text(ox + 4, oy + S - 16, '10T', {
      fontSize: '8px', fontFamily: 'monospace', color: MM.SCALE_LABEL,
    }).setDepth(144).setScrollFactor(0);
  }

  /** 전체 맵 타일 컬러 드로우 (최초 1회 또는 맵 변경 시) */
  drawTerrain(
    getTileColor: (tx: number, ty: number) => number | null,
  ): void {
    this.rt.clear();
    const PX = MM.SIZE / MM.MAP_TILES_W;  // 타일당 픽셀 수 (< 1일 경우 서브픽셀)

    // 전체 RenderTexture를 배경색으로 채움
    this.gfxHelper.clear().fillStyle(MM.BG, 1).fillRect(0, 0, MM.SIZE, MM.SIZE);
    this.rt.draw(this.gfxHelper, 0, 0);

    for (let ty = 0; ty < MM.MAP_TILES_H; ty++) {
      for (let tx = 0; tx < MM.MAP_TILES_W; tx++) {
        const color = getTileColor(tx, ty);
        if (color == null) continue;
        const px = Math.floor(tx * PX);
        const py = Math.floor(ty * PX);
        const pw = Math.max(1, Math.ceil(PX));

        this.gfxHelper.clear().fillStyle(color, 1).fillRect(px, py, pw, pw);
        this.rt.draw(this.gfxHelper, 0, 0);
      }
    }
  }

  /** 탐색 범위 공개 */
  revealArea(centerTX: number, centerTY: number, radiusTiles: number): void {
    const r = Math.ceil(radiusTiles);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const tx = centerTX + dx, ty = centerTY + dy;
        if (tx < 0 || tx >= MM.MAP_TILES_W || ty < 0 || ty >= MM.MAP_TILES_H) continue;
        if (!this.fogRevealed[ty][tx]) {
          this.fogRevealed[ty][tx] = true;
          this._eraseFog(tx, ty);
        }
      }
    }
  }

  private _drawFullFog(): void {
    this.fogRt.clear();
    this.gfxHelper.clear()
      .fillStyle(MM.FOG_COLOR, MM.FOG_ALPHA)
      .fillRect(0, 0, MM.SIZE, MM.SIZE);
    this.fogRt.draw(this.gfxHelper, 0, 0);
  }

  private _eraseFog(tx: number, ty: number): void {
    const PX = MM.SIZE / MM.MAP_TILES_W;
    const px = Math.floor(tx * PX);
    const py = Math.floor(ty * PX);
    const pw = Math.max(1, Math.ceil(PX));
    this.gfxHelper.clear().fillStyle(0xffffff, 1).fillRect(px, py, pw, pw);
    this.fogRt.erase(this.gfxHelper, 0, 0);
  }

  /** 마커 업데이트 (매 프레임) */
  updateMarkers(markers: MapMarkerData[]): void {
    const { width: W } = this.scene.scale;
    const ox = W - MM.SIZE - MM.MARGIN_R;
    const oy = MM.MARGIN_T;
    const PX = MM.SIZE / MM.MAP_TILES_W;

    this.markerGfx.clear();

    for (const m of markers) {
      const mx = Math.floor(m.tileX * PX);
      const my = Math.floor(m.tileY * PX);

      switch (m.type) {
        case 'player':
          // 흰색 삼각형 (방향 화살표)
          this.markerGfx.fillStyle(0xffffff, 1);
          this.markerGfx.fillTriangle(
            ox + mx, oy + my - 4,
            ox + mx - 3, oy + my + 3,
            ox + mx + 3, oy + my + 3,
          );
          // 깜빡이는 원
          const bAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
          this.markerGfx.lineStyle(1, 0xffffff, bAlpha * 0.6)
            .strokeCircle(ox + mx, oy + my, 5);
          break;

        case 'enemy':
          this.markerGfx.fillStyle(0xff4444, 0.9).fillCircle(ox + mx, oy + my, 2);
          break;

        case 'npc':
          this.markerGfx.fillStyle(0x44ff88, 0.9).fillCircle(ox + mx, oy + my, 2);
          break;

        case 'quest':
          // 황금 느낌표
          this.markerGfx.fillStyle(0xffdd00, 1)
            .fillRect(ox + mx - 1, oy + my - 4, 2, 4)
            .fillRect(ox + mx - 1, oy + my + 1, 2, 2);
          break;

        case 'chest':
          this.markerGfx.fillStyle(0xffaa44, 0.9)
            .fillRect(ox + mx - 2, oy + my - 2, 4, 4);
          break;

        case 'waypoint':
          this.markerGfx.lineStyle(1.5, 0x88ccff, 0.9)
            .strokeCircle(ox + mx, oy + my, 3);
          break;
      }
    }
  }

  /** 레이더 스캔 이펙트 (선택적) */
  updateRadarScan(delta: number): void {
    const { width: W } = this.scene.scale;
    const ox = W - MM.SIZE - MM.MARGIN_R + MM.SIZE / 2;
    const oy = MM.MARGIN_T + MM.SIZE / 2;

    this.scanAngle += delta * 0.001;  // 라디안/ms
    if (this.scanAngle > Math.PI * 2) this.scanAngle -= Math.PI * 2;

    // 스캔 라인 (녹색 반투명 쐐기)
    const scanGfx = this.scene.add.graphics().setDepth(142).setScrollFactor(0);
    const endX = ox + Math.cos(this.scanAngle) * MM.SIZE / 2;
    const endY = oy + Math.sin(this.scanAngle) * MM.SIZE / 2;
    scanGfx.lineStyle(1, 0x00ff88, 0.35).strokeLineShape(
      new Phaser.Geom.Line(ox, oy, endX, endY),
    );

    // 다음 프레임에 제거
    this.scene.time.delayedCall(16, () => scanGfx.destroy());
  }

  destroy(): void {
    this.rt.destroy();
    this.fogRt.destroy();
    this.markerGfx.destroy();
    this.frame.destroy();
    this.gfxHelper.destroy();
    this.container.destroy();
  }
}
```

---

## 3. 마커 타입 정의

```typescript
// src/ui/MapMarker.ts

export type MarkerType = 'player' | 'enemy' | 'npc' | 'quest' | 'chest' | 'waypoint';

export interface MapMarkerData {
  id: string;
  type: MarkerType;
  tileX: number;
  tileY: number;
  label?: string;
}

/** 웨이포인트 핑 이펙트 (지도에 클릭 마커) */
export function playMapPingFX(
  scene: Phaser.Scene,
  screenX: number,
  screenY: number,
): void {
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics()
      .lineStyle(1.5, 0x88ccff, 0.8)
      .strokeCircle(0, 0, 4)
      .setPosition(screenX, screenY)
      .setDepth(145)
      .setScrollFactor(0);

    scene.tweens.add({
      targets: ring,
      scaleX: 3 + i, scaleY: 3 + i, alpha: 0,
      duration: 500 + i * 150,
      delay: i * 100,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
```

---

## 4. 타일 컬러 팔레트

```typescript
// 타일 타입 → 미니맵 색상
export const MINIMAP_TILE_COLORS: Record<string, number> = {
  grass:       0x3a7a3a,
  dirt:        0x8a6a44,
  sand:        0xccaa66,
  water:       0x2255aa,
  shallow:     0x4477bb,
  rock:        0x667788,
  snow:        0xddeeff,
  lava:        0xff4411,
  path:        0xaa9977,
  forest:      0x1a5a1a,
  building:    0x445566,
  wall:        0x334455,
  chest:       0xffaa33,
  campfire:    0xff6622,
};
```

---

## 5. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 지형 RenderTexture  | 140   |
| 안개 레이어          | 141   |
| 마커 Graphics        | 142   |
| 레이더 스캔          | 142   |
| 테두리·UI            | 143   |
| 스케일 텍스트        | 144   |
| 핑 이펙트            | 145   |
