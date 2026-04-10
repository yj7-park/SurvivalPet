import type { ItemGrade } from '../data/ItemGrade';

export interface FishData {
  name:  string;
  grade: ItemGrade;
  size:  'small' | 'medium' | 'large';
}

export function playCastingEffect(
  scene: Phaser.Scene,
  playerX: number, playerY: number,
  bobberX: number, bobberY: number
): void {
  const STEPS = 12;
  for (let i = 0; i < STEPS; i++) {
    const t  = i / (STEPS - 1);
    const tx = playerX + (bobberX - playerX) * t;
    const ty = playerY + (bobberY - playerY) * t - Math.sin(t * Math.PI) * 60;

    scene.time.delayedCall(i * 30, () => {
      const dot = scene.add.graphics().setDepth(57);
      dot.fillStyle(0xffffff, 0.6 - t * 0.4);
      dot.fillCircle(tx, ty, Math.max(0.5, 2 - t * 1.5));
      scene.tweens.add({
        targets: dot, alpha: 0, duration: 200,
        onComplete: () => dot.destroy(),
      });
    });
  }
}

export function playFishCaughtEffect(
  scene: Phaser.Scene,
  playerX: number, playerY: number,
  fish: FishData
): void {
  const fontSize = fish.size === 'large' ? '22px' : '16px';
  const fishIcon = scene.add.text(playerX, playerY + 30, '🐟', { fontSize })
    .setOrigin(0.5).setDepth(58);

  scene.tweens.add({
    targets: fishIcon,
    x: playerX, y: playerY - 48,
    duration: 500, ease: 'Back.easeOut',
    onComplete: () => {
      const splash = scene.add.particles(playerX, playerY, '__DEFAULT', {
        speed:    { min: 40, max: 100 },
        angle:    { min: -150, max: -30 },
        scale:    { start: 0.5, end: 0 },
        lifespan: 500, quantity: 10,
        tint: 0x88aadd,
      });
      splash.setDepth(57);
      splash.explode(10);
      scene.time.delayedCall(600, () => splash.destroy());

      const GRADE_TEXT_COLORS: Record<string, string> = {
        common:    '#ffffff',
        uncommon:  '#44ff88',
        rare:      '#4488ff',
        epic:      '#aa44ff',
        legendary: '#ffaa00',
      };
      const gradeColor = GRADE_TEXT_COLORS[fish.grade] ?? '#ffffff';

      const txt = scene.add.text(
        playerX, playerY - 56,
        `${fish.name} 획득!`,
        { fontSize: '13px', color: gradeColor, fontFamily: 'Courier New', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 3 }
      ).setOrigin(0.5).setDepth(61);

      scene.tweens.add({
        targets: txt, y: playerY - 76, alpha: 0,
        duration: 1200, delay: 400, ease: 'Quad.easeOut',
        onComplete: () => { txt.destroy(); fishIcon.destroy(); },
      });
    },
  });
}

export function playFishEscapeEffect(
  scene: Phaser.Scene,
  bobberX: number, bobberY: number
): void {
  const splash = scene.add.particles(bobberX, bobberY, '__DEFAULT', {
    speed:    { min: 20, max: 60 },
    angle:    { min: 160, max: 200 },
    scale:    { start: 0.4, end: 0 },
    lifespan: 400, quantity: 6,
    tint: 0x88aadd,
  });
  splash.setDepth(57);
  splash.explode(6);
  scene.time.delayedCall(500, () => splash.destroy());

  const txt = scene.add.text(bobberX, bobberY - 24, '놓쳤다!',
    { fontSize: '12px', color: '#ff8888', fontFamily: 'Courier New',
      stroke: '#000', strokeThickness: 2 }
  ).setOrigin(0.5).setDepth(60);

  scene.tweens.add({
    targets: txt, y: bobberY - 44, alpha: 0,
    duration: 900, ease: 'Quad.easeOut',
    onComplete: () => txt.destroy(),
  });
}

export function playLineBreakEffect(
  scene: Phaser.Scene,
  linePoints: { x: number; y: number }[]
): void {
  if (linePoints.length === 0) return;
  const mid = linePoints[Math.floor(linePoints.length / 2)];

  const emitter = scene.add.particles(mid.x, mid.y, '__DEFAULT', {
    speed:    { min: 30, max: 80 },
    scale:    { start: 0.3, end: 0 },
    lifespan: 300, quantity: 8,
    tint: 0xffffff,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.setDepth(57);
  emitter.explode(8);
  scene.time.delayedCall(400, () => emitter.destroy());

  const txt = scene.add.text(mid.x, mid.y - 16, '줄 끊김!',
    { fontSize: '11px', color: '#ff4444', fontFamily: 'Courier New',
      stroke: '#000', strokeThickness: 2 }
  ).setOrigin(0.5).setDepth(60);

  scene.tweens.add({
    targets: txt, y: mid.y - 36, alpha: 0, duration: 800,
    onComplete: () => txt.destroy(),
  });
}

export function playBigFishReveal(
  scene: Phaser.Scene,
  fish: FishData,
  _playerX: number, _playerY: number
): void {
  if (fish.grade !== 'epic' && fish.grade !== 'legendary') return;

  scene.time.timeScale = 0.3;
  scene.time.delayedCall(800, () => { scene.time.timeScale = 1.0; });

  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  const bg = scene.add.rectangle(W / 2, H / 2, W, 80, 0x000000, 0.6)
    .setScrollFactor(0).setDepth(95);

  const GRADE_TEXT_COLORS: Record<string, string> = {
    epic:      '#aa44ff',
    legendary: '#ffaa00',
  };
  const label = fish.grade === 'legendary' ? `🏆 전설의 ${fish.name}!` : `✨ ${fish.name}!`;

  const fishTxt = scene.add.text(W / 2, H / 2, label,
    { fontSize: '20px', color: GRADE_TEXT_COLORS[fish.grade] ?? '#ffffff',
      fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4 }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(96).setAlpha(0);

  const slowFactor = 0.3;
  scene.tweens.add({
    targets: fishTxt, alpha: 1,
    scaleX: 1.2, scaleY: 1.2,
    duration: 300 / slowFactor,
    ease: 'Back.easeOut',
    yoyo: true, hold: 600 / slowFactor,
    onComplete: () => { fishTxt.destroy(); bg.destroy(); },
  });
}
