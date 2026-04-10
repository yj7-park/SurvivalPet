import Phaser from 'phaser';

export type ProgressBarColor =
  | 0xa06030  // chop (wood)
  | 0x808080  // mine (stone)
  | 0x4080c0  // fish (blue)
  | 0xc8a030  // build (gold)
  | 0xe06020  // cook (orange)
  | 0x8060c0  // craft (purple)
  | 0x4060c0  // sleep (blue-gray)
  | number;   // custom

/**
 * Draws a styled progress bar onto a Phaser.Graphics object.
 * The graphics is NOT cleared here — call gfx.clear() before if reusing.
 */
export function drawProgressBar(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,   // center x
  y: number,    // top y
  progress: number,  // 0~1
  color: number,
  width = 48,
): void {
  const h = 6;
  const bx = cx - width / 2;

  // Background capsule
  gfx.fillStyle(0x0a0806, 0.88);
  gfx.fillRoundedRect(bx, y, width, h, 3);

  // Fill
  const fw = Math.max(0, Math.floor(width * Math.min(1, progress)));
  if (fw > 0) {
    gfx.fillStyle(color, 0.45);
    gfx.fillRoundedRect(bx, y, fw, h, 3);
    gfx.fillStyle(color, 1.0);
    gfx.fillRoundedRect(bx, y + 1, fw, h - 3, 2);
    // Leading bright dot
    gfx.fillStyle(0xffffff, 0.55);
    gfx.fillRect(bx + fw - 2, y + 1, 2, h - 3);
  }

  // Border
  gfx.lineStyle(1, 0x3a2a14, 0.8);
  gfx.strokeRoundedRect(bx, y, width, h, 3);
}

/** Action-type color presets. */
export const PROGRESS_COLORS: Record<string, number> = {
  chop:   0xa06030,
  mine:   0x808080,
  fish:   0x4080c0,
  build:  0xc8a030,
  cook:   0xe06020,
  craft:  0x8060c0,
  sleep:  0x4060c0,
};
