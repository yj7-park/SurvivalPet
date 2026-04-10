export const enum GraphicsQuality {
  Low    = 0,
  Medium = 1,
  High   = 2,
}

export let GlobalParticleMultiplier = 1.0;

const PARTICLE_MULTIPLIERS = [0.3, 0.6, 1.0];
const RESOLUTION_SCALES    = [0.75, 0.88, 1.0];

export function applyGraphicsQuality(q: GraphicsQuality): void {
  GlobalParticleMultiplier = PARTICLE_MULTIPLIERS[q] ?? 1.0;
  const scale = RESOLUTION_SCALES[q] ?? 1.0;
  DynamicResolution.forceScale(scale);
}

export function scaleParticleCount(base: number): number {
  return Math.max(1, Math.round(base * GlobalParticleMultiplier));
}

/**
 * Stub for DynamicResolution — replace with real implementation when available.
 */
const DynamicResolution = {
  forceScale(scale: number): void {
    // Apply pixel ratio scaling to the Phaser canvas if available
    const canvas = document.querySelector<HTMLCanvasElement>('#phaser-canvas');
    if (canvas) {
      canvas.style.imageRendering = 'pixelated';
      const baseW = parseInt(canvas.getAttribute('data-base-width') ?? String(canvas.width));
      const baseH = parseInt(canvas.getAttribute('data-base-height') ?? String(canvas.height));
      canvas.style.width  = `${Math.round(baseW * scale)}px`;
      canvas.style.height = `${Math.round(baseH * scale)}px`;
    }
  }
};
