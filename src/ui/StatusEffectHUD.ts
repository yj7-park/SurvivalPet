import Phaser from 'phaser';
import { StatusEffectId } from '../systems/StatusEffectVisual';

const STATUS_HUD_CONFIG: Record<StatusEffectId, { icon: string; color: string; label: string }> = {
  cold:      { icon: '🥶', color: '#88aaff', label: '추위'     },
  freezing:  { icon: '🧊', color: '#aaccff', label: '동결'     },
  wet:       { icon: '💧', color: '#60b8f0', label: '젖음'     },
  poisoned:  { icon: '☠',  color: '#40cc40', label: '중독'     },
  burning:   { icon: '🔥', color: '#ff8020', label: '화상'     },
  exhausted: { icon: '😩', color: '#aa88cc', label: '기진맥진' },
  starving:  { icon: '🍖', color: '#cc9940', label: '기아'     },
  bleeding:  { icon: '🩸', color: '#cc1010', label: '출혈'     },
};

const DANGER_STATUSES: StatusEffectId[] = ['freezing', 'starving', 'bleeding'];

export class StatusEffectHUD {
  private rt: Phaser.GameObjects.RenderTexture;
  private blinkTween: Phaser.Tweens.Tween | null = null;
  private readonly W = 200;
  private readonly H = 22;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.rt = scene.add.renderTexture(x, y, this.W, this.H)
      .setScrollFactor(0)
      .setDepth(84);
  }

  update(
    activeStatuses: StatusEffectId[],
    durations?: Partial<Record<StatusEffectId, number>>
  ): void {
    this.rt.clear();

    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.W;
    offCanvas.height = this.H;
    const ctx = offCanvas.getContext('2d')!;

    activeStatuses.forEach((id, i) => {
      const cfg = STATUS_HUD_CONFIG[id];
      const cx = i * 22 + 9;
      const cy = 9;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = cfg.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();

      ctx.font = '10px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cfg.icon, cx, cy + 1);

      const remain = durations?.[id];
      if (remain !== undefined && remain > 0 && remain <= 99) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '7px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(remain)}`, cx, cy - 13);
      }
    });

    const tex = this.scene.textures.addCanvas('_status_hud_tmp', offCanvas);
    this.rt.draw(tex, 0, 0);

    const hasDanger = activeStatuses.some(s => DANGER_STATUSES.includes(s));
    if (hasDanger && !this.blinkTween) {
      this.blinkTween = this.scene.tweens.add({
        targets: this.rt,
        alpha: { from: 1.0, to: 0.2 },
        duration: 400, yoyo: true, repeat: -1
      });
    } else if (!hasDanger && this.blinkTween) {
      this.blinkTween.stop();
      this.blinkTween = null;
      this.rt.setAlpha(1.0);
    }
  }

  destroy(): void {
    this.blinkTween?.stop();
    this.rt.destroy();
  }
}
