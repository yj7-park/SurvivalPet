export const UI_COLORS = {
  // Panel backgrounds
  panelBg:        'rgba(18, 14, 10, 0.88)',
  panelBorder:    '#5a4428',
  panelBorderHi:  '#8a6840',

  // Slots
  slotBg:         'rgba(40, 30, 18, 0.90)',
  slotBorder:     '#3a2a14',
  slotHover:      '#6a4a28',
  slotSelected:   '#a06828',

  // Text
  textPrimary:    '#f0e0c8',
  textSecondary:  '#a09070',
  textDisabled:   '#504030',
  textDanger:     '#ff6666',
  textSuccess:    '#66cc66',
  textWarning:    '#ffcc44',

  // Gauge colors
  gaugeHp:        '#e84040',
  gaugeHpLow:     '#ff8080',
  gaugeHunger:    '#e8a030',
  gaugeFatigue:   '#4088e8',
  gaugeAction:    '#a060e8',
  gaugeTorch:     '#e8a820',
  gaugeBg:        'rgba(10, 8, 6, 0.80)',

  // Buttons
  btnBg:          'rgba(60, 44, 24, 0.90)',
  btnBgHover:     'rgba(90, 66, 36, 0.95)',
  btnBgActive:    'rgba(120, 90, 50, 1.0)',
  btnBorder:      '#7a5a30',

  // Phaser hex values
  gaugeHpHex:      0xe84040,
  gaugeHungerHex:  0xe8a030,
  gaugeFatigueHex: 0x4088e8,
  gaugeActionHex:  0xa060e8,
  gaugeBgHex:      0x0a0806,
  panelBorderHex:  0x5a4428,
  slotBgHex:       0x281e12,
};

export const UI_FONT = {
  primary:  '11px "Courier New", monospace',
  heading:  'bold 13px "Courier New", monospace',
  small:    '10px "Courier New", monospace',
  large:    'bold 16px "Courier New", monospace',
};

/** Common CSS for HTML-based panels */
export const PANEL_CSS = `
  background:${UI_COLORS.panelBg};
  border:1px solid ${UI_COLORS.panelBorder};
  border-radius:6px;
  color:${UI_COLORS.textPrimary};
  font:${UI_FONT.primary};
`;

export const BTN_CSS = `
  background:${UI_COLORS.btnBg};
  color:${UI_COLORS.textPrimary};
  border:1px solid ${UI_COLORS.btnBorder};
  border-radius:3px;
  cursor:pointer;
  font:${UI_FONT.small};
  transition:background 0.1s;
`;
