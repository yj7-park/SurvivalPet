export type CloudType = 'cumulus_small' | 'cumulus_large' | 'cirrus' | 'storm_cloud';
export type CloudTint = 'day' | 'sunset' | 'dawn' | 'storm';

const CLOUD_CONFIGS: Record<CloudType, { W: number; H: number }> = {
  cumulus_small: { W: 64,  H: 28 },
  cumulus_large: { W: 120, H: 44 },
  cirrus:        { W: 96,  H: 18 },
  storm_cloud:   { W: 160, H: 56 },
};

const CLOUD_COLORS: Record<CloudTint, { body: string; shadow: string; highlight: string }> = {
  day:    { body: '#f8f8f8', shadow: 'rgba(180,180,200,0.6)', highlight: 'rgba(255,255,255,0.9)' },
  sunset: { body: '#f0c080', shadow: 'rgba(200,100,60,0.6)',  highlight: 'rgba(255,220,140,0.9)' },
  dawn:   { body: '#e8b0c0', shadow: 'rgba(180,100,140,0.5)', highlight: 'rgba(255,200,220,0.9)' },
  storm:  { body: '#606070', shadow: 'rgba(40,40,50,0.8)',    highlight: 'rgba(90,90,100,0.6)'  },
};

export function drawCloud(
  ctx: CanvasRenderingContext2D,
  type: CloudType,
  tint: CloudTint
): void {
  const { W, H } = CLOUD_CONFIGS[type];
  const c = CLOUD_COLORS[tint];

  if (type === 'cirrus') {
    for (let i = 0; i < 4; i++) {
      const cx = W * (0.15 + i * 0.22);
      const cy = H * 0.5;
      const rx = W * 0.14;
      const ry = H * 0.35;
      ctx.fillStyle = c.body;
      ctx.globalAlpha = 0.5 - i * 0.05;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (type === 'storm_cloud') {
    ctx.fillStyle = c.shadow;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
    ctx.fillStyle = c.body;
    const bumps = [
      { x: W * 0.05, r: H * 0.35 }, { x: W * 0.2,  r: H * 0.40 },
      { x: W * 0.38, r: H * 0.45 }, { x: W * 0.55, r: H * 0.38 },
      { x: W * 0.72, r: H * 0.42 }, { x: W * 0.88, r: H * 0.32 },
    ];
    bumps.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, H * 0.5, b.r, Math.PI, 0, false);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(100,100,110,0.3)';
    ctx.fillRect(0, 0, W, H * 0.15);
    return;
  }

  // cumulus
  ctx.fillStyle = c.shadow;
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.72, W * 0.42, H * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.body;
  const blobCount = type === 'cumulus_large' ? 6 : 4;
  for (let i = 0; i < blobCount; i++) {
    const cx = W * (0.12 + i * (0.76 / (blobCount - 1)));
    const cy = H * 0.52;
    const r  = type === 'cumulus_large'
      ? H * (0.28 + (i === 1 || i === 3 ? 0.14 : 0))
      : H * (0.30 + (i === 1 ? 0.15 : 0));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = c.highlight;
  ctx.beginPath();
  ctx.ellipse(
    W * 0.38, H * 0.28,
    type === 'cumulus_large' ? W * 0.16 : W * 0.12,
    type === 'cumulus_large' ? H * 0.22 : H * 0.18,
    -0.3, 0, Math.PI * 2
  );
  ctx.fill();
}

export function getCloudTextureKey(type: CloudType, tint: CloudTint): string {
  return `cloud_${type}_${tint}`;
}

export function registerCloudTextures(scene: Phaser.Scene): void {
  const types: CloudType[] = ['cumulus_small', 'cumulus_large', 'cirrus', 'storm_cloud'];
  const tints: CloudTint[] = ['day', 'sunset', 'dawn', 'storm'];

  for (const type of types) {
    for (const tint of tints) {
      const key = getCloudTextureKey(type, tint);
      if (scene.textures.exists(key)) continue;

      const { W, H } = CLOUD_CONFIGS[type];
      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      drawCloud(ctx, type, tint);
      scene.textures.addCanvas(key, canvas);
    }
  }
}

export { CLOUD_CONFIGS };
