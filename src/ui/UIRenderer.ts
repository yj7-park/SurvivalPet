import Phaser from 'phaser';
import { UI_COLORS } from '../config/uiColors';

export class UIRenderer {
  /** Draw a rounded panel background with optional title */
  static drawPanel(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
  ): void {
    // Shadow
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillRoundedRect(x + 3, y + 3, w, h, 6);
    // Background
    gfx.fillStyle(0x120e0a, 0.88);
    gfx.fillRoundedRect(x, y, w, h, 6);
    // Top highlight
    gfx.fillStyle(0xffffff, 0.04);
    gfx.fillRoundedRect(x + 1, y + 1, w - 2, 8, 4);
    // Border
    gfx.lineStyle(1, UI_COLORS.panelBorderHex, 0.9);
    gfx.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 6);
  }

  /** Draw a gauge bar */
  static drawGauge(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    value: number, maxValue: number,
    color: number,
    width = 120, height = 8,
  ): void {
    const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;

    // Background track
    gfx.fillStyle(UI_COLORS.gaugeBgHex, 0.80);
    gfx.fillRoundedRect(x, y, width, height, 3);

    // Filled portion
    const fillW = Math.floor(width * ratio);
    if (fillW > 0) {
      gfx.fillStyle(color, 0.55);
      gfx.fillRoundedRect(x, y, fillW, height, 3);
      gfx.fillStyle(color, 1.0);
      gfx.fillRoundedRect(x, y + 1, fillW, height - 3, 2);
      // Highlight stripe
      gfx.fillStyle(0xffffff, 0.18);
      gfx.fillRect(x + 2, y + 1, Math.max(0, fillW - 4), 1);
    }

    // Border
    gfx.lineStyle(1, UI_COLORS.panelBorderHex, 0.9);
    gfx.strokeRoundedRect(x, y, width, height, 3);

    // Low-value pulse
    if (ratio <= 0.2) {
      const pulse = Math.sin(Date.now() * 0.006) * 0.3 + 0.7;
      gfx.fillStyle(0xffffff, pulse * 0.15);
      gfx.fillRoundedRect(x, y, Math.max(1, fillW), height, 3);
    }
  }

  /** Draw an inventory slot */
  static drawSlot(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    state: 'normal' | 'hover' | 'selected' | 'empty',
    size = 36,
  ): void {
    const bgColor = {
      normal:   0x281e12,
      hover:    0x4a3218,
      selected: 0x7a5020,
      empty:    0x1e1610,
    }[state];
    gfx.fillStyle(bgColor, 0.92);
    gfx.fillRoundedRect(x, y, size, size, 4);

    // Top shine
    gfx.fillStyle(0xffffff, 0.04);
    gfx.fillRoundedRect(x + 1, y + 1, size - 2, 8, 2);

    const borderColor = {
      normal:   0x3a2a14,
      hover:    0x6a4a28,
      selected: 0xaa7830,
      empty:    0x2a1e0e,
    }[state];
    gfx.lineStyle(1, borderColor, 1.0);
    gfx.strokeRoundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 4);

    if (state === 'hover' || state === 'selected') {
      gfx.lineStyle(1, 0xffffff, 0.12);
      gfx.strokeRoundedRect(x + 1, y + 1, size - 2, size - 2, 3);
    }
  }

  /** Apply theme CSS to an HTML panel div */
  static applyPanelTheme(el: HTMLElement): void {
    el.style.background = UI_COLORS.panelBg;
    el.style.border = `1px solid ${UI_COLORS.panelBorder}`;
    el.style.color = UI_COLORS.textPrimary;
    el.style.fontFamily = '"Courier New", monospace';
    el.style.fontSize = '11px';
    el.style.borderRadius = '6px';
  }

  /** Apply theme CSS to a button */
  static applyBtnTheme(btn: HTMLElement, canAct = true): void {
    if (canAct) {
      btn.style.background = UI_COLORS.btnBg;
      btn.style.color = UI_COLORS.textPrimary;
      btn.style.border = `1px solid ${UI_COLORS.btnBorder}`;
    } else {
      btn.style.background = 'rgba(30,22,12,0.80)';
      btn.style.color = UI_COLORS.textDisabled;
      btn.style.border = `1px solid #3a2a14`;
    }
    btn.style.borderRadius = '3px';
    btn.style.cursor = canAct ? 'pointer' : 'default';
    btn.style.fontFamily = '"Courier New", monospace';
    btn.style.fontSize = '10px';
    btn.style.transition = 'background 0.1s';
  }
}
