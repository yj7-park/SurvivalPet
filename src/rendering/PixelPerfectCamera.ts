import Phaser from 'phaser';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 타일 기반 게임용 픽셀 퍼펙트 카메라 유틸리티.
 * roundPixels = true 설정으로 sub-pixel 렌더링 흔들림 제거.
 */
export class PixelPerfectCamera {
  private cam: Phaser.Cameras.Scene2D.Camera;

  constructor(cam: Phaser.Cameras.Scene2D.Camera) {
    this.cam = cam;
    cam.roundPixels = true;
  }

  /** 카메라 스크롤을 정수 좌표로 강제 */
  follow(targetX: number, targetY: number): void {
    this.cam.scrollX = Math.round(targetX - this.cam.width  / 2);
    this.cam.scrollY = Math.round(targetY - this.cam.height / 2);
  }

  /** 맵 경계로 클램프 */
  clampToBounds(mapW: number, mapH: number): void {
    this.cam.scrollX = Math.round(clamp(this.cam.scrollX, 0, mapW  - this.cam.width));
    this.cam.scrollY = Math.round(clamp(this.cam.scrollY, 0, mapH - this.cam.height));
  }
}
