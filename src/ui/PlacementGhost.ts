export type PlacementValidator = (tileX: number, tileY: number) => boolean;

export class PlacementGhost {
  private ghostSprite?: Phaser.GameObjects.Image;
  private validOverlay?: Phaser.GameObjects.Graphics;
  private gridLines?: Phaser.GameObjects.Graphics;
  private scene?: Phaser.Scene;
  private checkValid?: PlacementValidator;
  private tileW = 1;
  private tileH = 1;

  attach(
    scene: Phaser.Scene,
    buildingKey: string,
    tileW: number,
    tileH: number,
    checkValid: PlacementValidator
  ): void {
    this.scene      = scene;
    this.tileW      = tileW;
    this.tileH      = tileH;
    this.checkValid = checkValid;

    this.ghostSprite = scene.add.image(0, 0, buildingKey)
      .setAlpha(0.55)
      .setTint(0x88bbff)
      .setDepth(50);

    this.validOverlay = scene.add.graphics().setDepth(51);
    this.gridLines    = scene.add.graphics().setDepth(49).setAlpha(0.2);
    this.drawGridLines(scene);

    scene.input.on('pointermove', this.onPointerMove, this);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ghostSprite || !this.validOverlay || !this.checkValid) return;
    const wx    = pointer.worldX;
    const wy    = pointer.worldY;
    const snapX = Math.floor(wx / 32) * 32;
    const snapY = Math.floor(wy / 32) * 32;

    this.ghostSprite.setPosition(
      snapX + this.ghostSprite.width  / 2,
      snapY + this.ghostSprite.height / 2
    );

    const canPlace = this.checkValid(snapX / 32, snapY / 32);
    this.refreshOverlay(snapX, snapY, canPlace);
    this.ghostSprite.setTint(canPlace ? 0x88ffaa : 0xff6666);
  }

  private refreshOverlay(sx: number, sy: number, canPlace: boolean): void {
    if (!this.ghostSprite || !this.validOverlay) return;
    const color = canPlace ? 0x44ff88 : 0xff4444;
    const alpha = canPlace ? 0.12    : 0.22;
    const w     = this.ghostSprite.width;
    const h     = this.ghostSprite.height;

    this.validOverlay.clear();
    this.validOverlay.fillStyle(color, alpha);
    this.validOverlay.fillRect(sx, sy, w, h);
    this.validOverlay.lineStyle(1.5, color, canPlace ? 0.6 : 0.9);
    this.validOverlay.strokeRect(sx, sy, w, h);
  }

  private drawGridLines(scene: Phaser.Scene): void {
    if (!this.gridLines) return;
    const cam    = scene.cameras.main;
    const startX = Math.floor(cam.scrollX / 32) * 32;
    const startY = Math.floor(cam.scrollY / 32) * 32;

    this.gridLines.clear();
    this.gridLines.lineStyle(0.5, 0x88aaff, 0.3);

    for (let x = startX; x < startX + cam.width + 32; x += 32) {
      this.gridLines.beginPath();
      this.gridLines.moveTo(x, startY);
      this.gridLines.lineTo(x, startY + cam.height + 32);
      this.gridLines.strokePath();
    }
    for (let y = startY; y < startY + cam.height + 32; y += 32) {
      this.gridLines.beginPath();
      this.gridLines.moveTo(startX, y);
      this.gridLines.lineTo(startX + cam.width + 32, y);
      this.gridLines.strokePath();
    }
  }

  playConfirm(): void {
    if (!this.ghostSprite || !this.scene) return;
    this.scene.tweens.add({
      targets: this.ghostSprite,
      alpha: 1.0, scaleX: 1.08, scaleY: 1.08,
      duration: 80, yoyo: true,
      onComplete: () => this.detach(),
    });
  }

  detach(): void {
    if (this.scene) {
      this.scene.input.off('pointermove', this.onPointerMove, this);
    }
    this.ghostSprite?.destroy();
    this.validOverlay?.destroy();
    this.gridLines?.destroy();
    this.ghostSprite  = undefined;
    this.validOverlay = undefined;
    this.gridLines    = undefined;
  }
}

export function playBuildSnapEffect(
  scene: Phaser.Scene,
  tileX: number, tileY: number,
  tileW: number, tileH: number
): void {
  const px = tileX * 32, py = tileY * 32;
  const pw = tileW * 32, ph = tileH * 32;

  for (let ci = 0; ci < 4; ci++) {
    const cx = px + (ci % 2) * pw;
    const cy = py + Math.floor(ci / 2) * ph;
    const ring = scene.add.graphics().setDepth(52);
    ring.lineStyle(1.5, 0x88ffcc, 0.8);
    ring.strokeCircle(cx, cy, 10);

    scene.tweens.add({
      targets: ring,
      x: (px + pw / 2) - cx,
      y: (py + ph / 2) - cy,
      alpha: 0,
      duration: 250, ease: 'Quad.easeIn',
      onComplete: () => ring.destroy(),
    });
  }

  const border = scene.add.graphics().setDepth(52);
  border.lineStyle(2, 0x88ffcc, 1.0);
  border.strokeRect(px, py, pw, ph);
  scene.tweens.add({
    targets: border,
    alpha: 0, scaleX: 1.05, scaleY: 1.05,
    duration: 350,
    onComplete: () => border.destroy(),
  });
}
