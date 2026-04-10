import { VirtualJoystick } from '../ui/VirtualJoystick';
import { ActionButtonBar, ActionKey } from '../ui/ActionButtonBar';

export const isTouchDevice: boolean =
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  localStorage.getItem('sv_force_touch') === '1';

export class TouchInputSystem {
  private enabled = false;
  private joystick!: VirtualJoystick;
  private actionBar!: ActionButtonBar;
  private joystickTouchIds = new Set<number>();
  private lastPinchDist = 0;
  private onZoom?: (delta: number) => void;
  private onActionPress?: (key: ActionKey) => void;

  private touchStartHandler!: (e: TouchEvent) => void;
  private touchMoveHandler!: (e: TouchEvent) => void;
  private touchEndHandler!: (e: TouchEvent) => void;

  setOnZoom(cb: (delta: number) => void): void { this.onZoom = cb; }
  setOnActionPress(cb: (key: ActionKey) => void): void { this.onActionPress = cb; }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    this.joystick = new VirtualJoystick();
    this.actionBar = new ActionButtonBar((key) => this.onActionPress?.(key));

    this.touchStartHandler = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        // Only use left half of screen for joystick
        if (t.clientX < window.innerWidth / 2) {
          this.joystick.handleTouchStart(t);
          this.joystickTouchIds.add(t.identifier);
        }
      }
      // Pinch detection
      if (e.touches.length === 2) {
        this.lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };

    this.touchMoveHandler = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.joystickTouchIds.has(t.identifier)) {
          this.joystick.handleTouchMove(t);
        }
      }
      // Pinch zoom
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const delta = dist - this.lastPinchDist;
        if (Math.abs(delta) > 1) this.onZoom?.(delta * 0.005);
        this.lastPinchDist = dist;
      }
    };

    this.touchEndHandler = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        this.joystick.handleTouchEnd(t.identifier);
        this.joystickTouchIds.delete(t.identifier);
      }
    };

    document.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    document.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    document.addEventListener('touchend', this.touchEndHandler);
    document.addEventListener('touchcancel', this.touchEndHandler);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    document.removeEventListener('touchstart', this.touchStartHandler);
    document.removeEventListener('touchmove', this.touchMoveHandler);
    document.removeEventListener('touchend', this.touchEndHandler);
    document.removeEventListener('touchcancel', this.touchEndHandler);
    this.joystick?.destroy();
    this.actionBar?.destroy();
  }

  getMovementVector(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    const s = this.joystick.getState();
    if (!s.active) return { x: 0, y: 0 };
    return { x: s.dx, y: s.dy };
  }

  isButtonDown(key: ActionKey): boolean {
    if (!this.enabled) return false;
    return this.actionBar.isPressed(key);
  }

  isEnabled(): boolean { return this.enabled; }
}
