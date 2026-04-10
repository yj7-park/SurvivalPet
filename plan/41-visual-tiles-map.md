# 설계 41 — 맵 타일 비주얼 고도화

> **전제 조건**: 01~40 단계 완료 상태.
> plan 03(기본 타일), plan 08(계절/날씨), plan 09(물 애니메이션)를 기반으로
> 타일 연결(Autotile), 계절별 색상, 물 애니메이션을 확정한다.

---

## 1. 이번 단계 목표

1. **Autotile 연결** — 물·암반 타일이 이웃 타일에 따라 자연스럽게 연결
2. **계절별 타일 팔레트** — 흙·나무 색상이 봄/여름/가을/겨울마다 변화
3. **물 애니메이션 스프라이트시트** — plan 09에서 코드로만 정의된 물결을 프레임으로 확정
4. **타일 장식 레이어** — 흙 위에 풀·꽃·자갈 소품 스프라이트 산포
5. **날씨별 타일 오버레이** — 눈 쌓임, 비에 젖은 흙 표현

---

## 2. 타일 스프라이트시트 구조

### 2-1. 기본 타일 (32×32px)

| 키 | 프레임 수 | 설명 |
|----|---------|------|
| `tile_dirt` | 1 | 기본 흙 (계절 오버레이로 색상 변경) |
| `tile_water` | 4 | 물결 4프레임 루프 (각 32×32) |
| `tile_rock` | 1 | 암반 기본 |
| `tile_rock_edge_N/S/E/W` | 각 1 | 암반-흙 경계 모서리 4방향 |
| `tile_rock_corner_NE/NW/SE/SW` | 각 1 | 암반 코너 4종 |
| `tile_sand` | 1 | 강변 모래 (물 인접 흙 타일 → 자동 치환) |
| `tile_farmland_dry` | 1 | 건조 경작지 (plan 39) |
| `tile_farmland_wet` | 1 | 촉촉한 경작지 |

### 2-2. 물 타일 애니메이션 (4프레임 × 32×32 = 128×32 스프라이트시트)

```typescript
// SpriteGenerator — 물 타일 4프레임
// frame 0: 기본 수면, 잔잔한 반짝임
// frame 1: 작은 물결 우상단
// frame 2: 물결 중간
// frame 3: 물결 좌하단으로 이동

this.anims.create({
  key: 'water_ripple',
  frames: this.anims.generateFrameNumbers('tile_water_anim', { start: 0, end: 3 }),
  frameRate: 3,       // 3fps — 느리게 찰랑이는 효과
  repeat: -1,
  yoyo: true,         // 0→1→2→3→2→1→0 반복 (부드러운 역재생)
});
```

각 프레임 드로잉 (Canvas API):
```typescript
function drawWaterFrame(ctx: CanvasRenderingContext2D, frame: number, season: Season): void {
  const colors = WATER_COLORS[season];
  // 기본 수면 색
  ctx.fillStyle = colors.base;
  ctx.fillRect(0, 0, 32, 32);

  // 깊이감 (하단 약간 어둡게)
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, colors.shallow);
  grad.addColorStop(1, colors.deep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  // 물결 하이라이트 (프레임별 x 오프셋)
  const waveX = frame * 4;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  // 사인 곡선 형태의 흰 줄
  for (let y = 4; y < 32; y += 9) {
    ctx.beginPath();
    for (let x = 0; x < 32; x++) {
      const wy = y + Math.sin((x + waveX) * 0.4) * 2;
      x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

const WATER_COLORS: Record<Season, { base: string; shallow: string; deep: string }> = {
  spring: { base: '#4a8fc0', shallow: 'rgba(100,180,220,0.6)', deep: 'rgba(30,80,140,0.4)' },
  summer: { base: '#3a9fd0', shallow: 'rgba(80,200,240,0.6)', deep: 'rgba(20,90,160,0.4)' },
  autumn: { base: '#4a7aaa', shallow: 'rgba(80,150,190,0.5)', deep: 'rgba(30,70,130,0.4)' },
  winter: { base: '#6a9ab8', shallow: 'rgba(150,200,230,0.5)', deep: 'rgba(60,110,160,0.4)' },
};
```

---

## 3. Autotile 연결 시스템

### 3-1. 4방향 비트마스크

```typescript
// 각 타일이 이웃 타입과 어떻게 연결되는지 판별
// 비트: N=1, E=2, S=4, W=8
function getAutotileIndex(tileMap: TileType[][], tx: number, ty: number, type: TileType): number {
  const n = isSameType(tileMap, tx,   ty-1, type) ? 1 : 0;
  const e = isSameType(tileMap, tx+1, ty,   type) ? 2 : 0;
  const s = isSameType(tileMap, tx,   ty+1, type) ? 4 : 0;
  const w = isSameType(tileMap, tx-1, ty,   type) ? 8 : 0;
  return n | e | s | w;  // 0~15
}
```

암반 타일에 적용:
| 인덱스 | 연결 | 스프라이트 변형 |
|--------|------|--------------|
| 0 | 고립 | 기본 암반 |
| 1 | 북만 | 남쪽 면 노출 |
| 3 | 북+동 | 서남 코너 |
| 5 | 북+남 | 수직 띠 |
| 15 | 전방향 | 완전 채움 (중앙부) |

구현 방식: 16종 변형 스프라이트 대신 **기본 타일 + 모서리 오버레이** 합성:
```typescript
// 암반 기본 블록 그리기 → 열린 면에 부드러운 경사 오버레이 추가
function drawRockAutotile(ctx: CanvasRenderingContext2D, index: number): void {
  drawRockBase(ctx);
  if (!(index & 1)) drawEdge(ctx, 'north');  // 북쪽 이웃 없으면 북쪽 경사
  if (!(index & 2)) drawEdge(ctx, 'east');
  if (!(index & 4)) drawEdge(ctx, 'south');
  if (!(index & 8)) drawEdge(ctx, 'west');
}
```

### 3-2. 강변 모래 자동 치환

물 타일에 인접한 흙 타일 → `tile_sand` 로 자동 렌더 (저장 데이터는 흙 그대로):
```typescript
function getEffectiveTile(tileMap, tx, ty): SpriteKey {
  if (tileMap[ty][tx] === 'dirt') {
    const adj4 = [[-1,0],[1,0],[0,-1],[0,1]];
    const nearWater = adj4.some(([dx,dy]) => tileMap[ty+dy]?.[tx+dx] === 'water');
    if (nearWater) return 'tile_sand';
  }
  return BASE_TILE_SPRITE[tileMap[ty][tx]];
}
```

---

## 4. 계절별 타일 팔레트

계절이 바뀌면 흙 타일 색상 즉시 전환 (텍스처 재생성 또는 틴트 적용):

```typescript
const DIRT_TINTS: Record<Season, number> = {
  spring: 0xd4a876,   // 따뜻한 갈색 (촉촉)
  summer: 0xc49060,   // 건조한 황토색
  autumn: 0xb8844a,   // 붉은빛 갈색
  winter: 0xc8c0b0,   // 회백색 (눈 덮인 느낌)
};

// 계절 전환 시
tileSprites.forEach(s => {
  if (s.tileType === 'dirt') {
    scene.tweens.add({
      targets: s,
      tint: DIRT_TINTS[newSeason],   // Phaser tint 트윈은 직접 지원 안됨
      // → 대신: 0.5초 걸쳐 tint를 lerp 적용
      duration: 500,
      onUpdate: (tween) => {
        s.setTint(lerpColor(prevTint, DIRT_TINTS[newSeason], tween.progress));
      },
    });
  }
});
```

---

## 5. 타일 장식 레이어 (Decoration Layer)

### 5-1. 소품 스프라이트

흙 타일 위에 렌더되는 소형 장식 (이동 차단 없음):

| 키 | 크기 | 출현 조건 | 밀도 |
|----|------|---------|------|
| `deco_grass_short` | 16×12 | 흙 타일, 봄·여름 | 15% |
| `deco_grass_tall` | 16×18 | 흙 타일, 여름 | 8% |
| `deco_flower_yellow` | 12×14 | 흙 타일, 봄 | 4% |
| `deco_flower_white` | 12×14 | 흙 타일, 봄·여름 | 3% |
| `deco_pebble` | 10×8 | 암반 인접 흙 | 10% |
| `deco_dead_grass` | 16×10 | 흙 타일, 가을 | 12% |
| `deco_snow_patch` | 20×8 | 흙 타일, 겨울 | 20% |
| `deco_fallen_leaf` | 14×10 | 흙 타일, 가을 | 10% |

배치 규칙:
- seed 기반 Poisson Disk Sampling (최소 간격 16px)
- 건설물·작물 타일에는 미표시
- 각 소품은 레이어 depth 1.5 (타일 위, 오브젝트 아래)

### 5-2. SpriteGenerator 드로잉

```typescript
// 짧은 풀
function drawGrassShort(ctx: CanvasRenderingContext2D, season: Season): void {
  const color = GRASS_COLORS[season];
  ctx.strokeStyle = color.dark;
  ctx.lineWidth = 1.5;
  // 3개의 짧은 날 (약간씩 기울임)
  [[6, 12, 5, 4], [8, 12, 8, 3], [10, 12, 11, 5]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
}

const GRASS_COLORS = {
  spring: { dark: '#4a9a30', light: '#6abe48' },
  summer: { dark: '#3a8820', light: '#58aa38' },
  autumn: { dark: '#b07820', light: '#d09030' },
  winter: { dark: '#808070', light: '#a0a090' },
};
```

---

## 6. 날씨별 타일 오버레이

### 6-1. 눈 쌓임 (겨울 눈/블리자드)

```typescript
// 눈 쌓임 강도: 0.0(없음) ~ 1.0(완전히 덮임)
// 눈이 올수록 snowAccumulation 증가, 비 오면 감소
let snowAccumulation = 0;   // 게임 전역

// 타일 렌더 시 눈 오버레이
if (snowAccumulation > 0) {
  ctx.fillStyle = `rgba(230, 240, 255, ${snowAccumulation * 0.7})`;
  ctx.fillRect(0, 0, 32, 32);
  // 덜 쌓인 경우: 아래쪽에만 흰색 띠
  if (snowAccumulation < 0.5) {
    ctx.fillStyle = `rgba(230, 240, 255, ${snowAccumulation})`;
    ctx.fillRect(0, 32 - Math.floor(snowAccumulation * 20), 32, Math.floor(snowAccumulation * 20));
  }
}
```

### 6-2. 비에 젖은 흙

```typescript
// 비 날씨 시 흙 타일에 어두운 반투명 오버레이
if (weather === 'rain' || weather === 'storm') {
  ctx.fillStyle = 'rgba(0, 0, 60, 0.15)';
  ctx.fillRect(0, 0, 32, 32);
}
```

---

## 7. TileRenderer 클래스

```typescript
export class TileRenderer {
  private decorations: Map<string, DecoSprite[]>;  // tileKey → 소품 목록

  // 맵 로드 시 소품 배치 계산
  generateDecorations(tileMap: TileType[][], seed: string, season: Season): void

  // 계절 전환 시 소품 갱신
  onSeasonChanged(season: Season): void

  // 날씨 변경 시 오버레이 갱신
  onWeatherChanged(weather: WeatherType): void

  // 매 프레임: 물 애니메이션 틱
  update(delta: number): void

  // 타일 1개 렌더 (autotile 인덱스 포함)
  renderTile(tx: number, ty: number): void
}
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/world/SpriteGenerator.ts` | 물 4프레임 시트, 암반 autotile 16종, 소품 8종, 강변 모래 추가 |
| `src/rendering/TileRenderer.ts` | 신규: autotile·소품·날씨 오버레이·계절 틴트 통합 |
| `src/world/MapGenerator.ts` | 강변 모래 판별 로직, 소품 seed 기반 배치 |
| `src/scenes/GameScene.ts` | TileRenderer 교체, 계절·날씨 이벤트 연결 |

---

## 9. 확정 규칙

- 물 애니메이션: 낮에만 재생 (밤 → frameRate 1로 낮춤, 성능 절약)
- Autotile 계산: 맵 로드 시 1회, 이후 건설·철거 시 인접 8칸만 재계산
- 소품은 씨드 고정 → 멀티플레이어 전원 동일하게 보임 (Firebase 동기화 불필요)
- 계절 타일 틴트 전환: 0.5초 lerp (너무 급격한 색 변화 방지)
- 눈 쌓임은 로컬 계산 (시각 효과용), Firebase 저장 안 함
- 강변 모래 판별은 렌더 시점에 실시간 계산 (타일 데이터 변경 없음)
