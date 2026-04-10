import Phaser from 'phaser';
import { TutorialBox } from '../ui/TutorialBox';
import { TutorialHighlight } from '../ui/TutorialHighlight';
import { TutorialSpotlight } from '../ui/TutorialSpotlight';
import { TutorialArrow, ArrowDirection } from '../ui/TutorialArrow';
import { TutorialPanel } from '../ui/TutorialPanel';

export type TutorialEvent =
  | 'inventory_opened'
  | 'building_built'
  | 'item_crafted'
  | 'fish_completed'
  | 'food_eaten'
  | 'sleep_completed';

export interface TutorialGameState {
  playerX: number;
  playerY: number;
  woodCount: number;
  stoneCount: number;
  buildingCount: number;
  // Camera world-to-screen projection
  worldToScreen: (wx: number, wy: number) => { x: number; y: number };
  // Nearest tile finders (world coords)
  nearestTree: () => { wx: number; wy: number } | null;
  nearestRock: () => { wx: number; wy: number } | null;
  nearestWater: () => { wx: number; wy: number } | null;
}

const STORAGE_KEY = 'sv_tutorial_done';
const TOTAL_STEPS = 10;

interface Step {
  lines: string[];
  highlight: 'tree' | 'rock' | 'water' | null;
  arrowDir?: ArrowDirection;
  keyIcon?: string;
  condition: (state: TutorialGameState, events: Set<TutorialEvent>) => boolean;
}

const STEPS: Step[] = [
  {
    lines: ['방향키(↑↓←→)로 캐릭터를 이동해보세요.'],
    highlight: null,
    arrowDir: undefined,
    keyIcon: '↑↓←→',
    condition: (s, _) => { void s; return false; },
  },
  {
    lines: ['나무를 클릭해 목재를 얻으세요.', '가까이 이동하면 자동으로 벌목을 시작합니다.'],
    highlight: 'tree',
    arrowDir: 'down',
    keyIcon: 'E',
    condition: (s, _) => s.woodCount >= 1,
  },
  {
    lines: ['V 키를 눌러 인벤토리를 열어보세요.'],
    highlight: null,
    keyIcon: 'V',
    condition: (_, e) => e.has('inventory_opened'),
  },
  {
    lines: ['암반(회색 바위)을 클릭해 석재를 채굴하세요.', '암반은 한 번 채굴하면 재생되지 않습니다.'],
    highlight: 'rock',
    arrowDir: 'down',
    keyIcon: 'E',
    condition: (s, _) => s.stoneCount >= 1,
  },
  {
    lines: ['B 키를 눌러 건설 패널을 열고', '목재 벽을 하나 세워보세요.'],
    highlight: null,
    keyIcon: 'B',
    condition: (_, e) => e.has('building_built'),
  },
  {
    lines: ['작업대를 건설한 뒤 클릭해 아이템을 만들어보세요.', '낚싯대가 있으면 낚시 성공률이 오릅니다.'],
    highlight: null,
    keyIcon: 'LMB',
    condition: (_, e) => e.has('item_crafted'),
  },
  {
    lines: ['물 타일 근처로 이동해 물을 클릭하면 낚시를 시작합니다.', '허기가 줄어들면 생선을 구워 먹어야 합니다.'],
    highlight: 'water',
    arrowDir: 'down',
    keyIcon: 'LMB',
    condition: (_, e) => e.has('fish_completed'),
  },
  {
    lines: ['조리대를 건설하고 물고기를 구워보세요.', '날것을 먹으면 식중독에 걸릴 수 있습니다.'],
    highlight: null,
    keyIcon: 'E',
    condition: (_, e) => e.has('food_eaten'),
  },
  {
    lines: ['침대를 건설하고 자면 피로를 회복할 수 있습니다.', '피로가 0이 되면 그 자리에 쓰러집니다!'],
    highlight: null,
    keyIcon: 'E',
    condition: (_, e) => e.has('sleep_completed'),
  },
  {
    lines: ['기본 조작을 모두 익혔습니다! 🎉', 'H 키를 누르면 언제든 조작 가이드를 볼 수 있습니다.', '살아남으세요!'],
    highlight: null,
    condition: (_, __) => false,
  },
];

function playStepCompleteEffect(scene: Phaser.Scene, stepIndex: number): void {
  const { width: W, height: H } = scene.scale;
  const check = scene.add.text(
    W / 2, H - 130, '✓',
    { fontSize: '24px', color: '#40e060', stroke: '#000000', strokeThickness: 2 },
  ).setScrollFactor(0).setDepth(122).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: check,
    alpha: { from: 0, to: 1 },
    scaleX: { from: 0.5, to: 1.0 },
    scaleY: { from: 0.5, to: 1.0 },
    duration: 300, ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(600, () => {
        scene.tweens.add({
          targets: check, alpha: 0, y: check.y - 20,
          duration: 300,
          onComplete: () => check.destroy(),
        });
      });
    },
  });

  if (stepIndex === TOTAL_STEPS - 1) {
    playTutorialCompleteEffect(scene);
  }
}

function playTutorialCompleteEffect(scene: Phaser.Scene): void {
  const { width: W, height: H } = scene.scale;
  const cx = W / 2, cy = H / 2;

  if (scene.textures.exists('fx_pixel')) {
    const emitter = scene.add.particles(cx, cy, 'fx_pixel', {
      tint:     [0xf0c030, 0xffffff, 0x40e060, 0x4080e0],
      speed:    { min: 80, max: 200 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.5, end: 0 },
      alpha:    { start: 1.0, end: 0 },
      lifespan: 1000,
      quantity: 20,
      emitting: false,
    }).setScrollFactor(0).setDepth(125);
    emitter.explode(20);
    scene.time.delayedCall(1500, () => emitter.destroy());
  }

  const done = scene.add.text(cx, cy - 20, '튜토리얼 완료!', {
    fontSize: '20px', fontFamily: 'Courier New',
    color: '#f0c030', stroke: '#000000', strokeThickness: 3,
  }).setScrollFactor(0).setDepth(125).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: done,
    alpha: 1, y: cy - 40,
    duration: 500, ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: done, alpha: 0,
          duration: 500,
          onComplete: () => done.destroy(),
        });
      });
    },
  });
}

export class TutorialSystem {
  private currentStep = 0;
  private active = false;
  private events = new Set<TutorialEvent>();
  private box = new TutorialBox();
  private highlight = new TutorialHighlight();
  private startX = 0;
  private startY = 0;
  private movedEnough = false;

  // Phaser-based visual components (initialized on start if scene is provided)
  private scene: Phaser.Scene | null = null;
  private spotlight: TutorialSpotlight | null = null;
  private arrow: TutorialArrow | null = null;
  private panel: TutorialPanel | null = null;

  /** Returns true if tutorial has already been completed. */
  static isDone(): boolean {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  static reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Provide Phaser scene for enhanced visual components */
  initScene(scene: Phaser.Scene): void {
    this.scene = scene;
    this.spotlight = new TutorialSpotlight(scene);
    this.arrow = new TutorialArrow(scene);
    this.panel = new TutorialPanel(scene);
  }

  start(state: TutorialGameState): void {
    if (this.active) return;
    this.active = true;
    this.currentStep = 0;
    this.events.clear();
    this.movedEnough = false;
    this.startX = state.playerX;
    this.startY = state.playerY;
    this.showStep(state);
  }

  isActive(): boolean { return this.active; }

  /** Notify tutorial of a game event */
  onEvent(event: TutorialEvent): void {
    if (!this.active) return;
    this.events.add(event);
  }

  /** Call every frame. Returns true if tutorial is still active. */
  update(state: TutorialGameState): boolean {
    if (!this.active) return false;
    const step = STEPS[this.currentStep];
    if (!step) return false;

    // Step 0 (movement): check distance
    let conditionMet = false;
    if (this.currentStep === 0) {
      const dx = state.playerX - this.startX;
      const dy = state.playerY - this.startY;
      if (Math.hypot(dx, dy) >= 32) this.movedEnough = true;
      conditionMet = this.movedEnough;
    } else {
      conditionMet = step.condition(state, this.events);
    }

    if (conditionMet) {
      if (this.currentStep < TOTAL_STEPS - 1) {
        this.box.setNextEnabled(true);
      }
    }

    // Update highlight + arrow position if applicable
    if (step.highlight) {
      let pos: { wx: number; wy: number } | null = null;
      if (step.highlight === 'tree') pos = state.nearestTree();
      else if (step.highlight === 'rock') pos = state.nearestRock();
      else if (step.highlight === 'water') pos = state.nearestWater();
      if (pos) {
        const sc = state.worldToScreen(pos.wx, pos.wy);
        this.highlight.show(sc.x, sc.y, 64);
        if (step.arrowDir && this.arrow) {
          this.arrow.point(sc.x, sc.y, step.arrowDir, 80);
        }
        // Update spotlight for world targets
        if (this.spotlight) {
          this.spotlight.show({ type: 'circle', x: sc.x, y: sc.y, r: 40 });
        }
      } else {
        this.highlight.hide();
        this.arrow?.hide();
      }
    }

    return true;
  }

  private showStep(state: TutorialGameState): void {
    const step = STEPS[this.currentStep];
    if (!step) return;

    const conditionAlreadyMet = this.currentStep === 0
      ? this.movedEnough
      : step.condition(state, this.events);

    this.box.show(
      this.currentStep + 1,
      TOTAL_STEPS,
      step.lines,
      conditionAlreadyMet || this.currentStep === TOTAL_STEPS - 1,
      {
        onNext: () => this.advance(state),
        onSkip: () => this.skip(),
      },
    );

    // Phaser panel
    this.panel?.show(
      this.currentStep,
      TOTAL_STEPS,
      step.lines.join('\n'),
      () => this.skip(),
    );

    // Spotlight for non-world targets
    if (!step.highlight) {
      this.spotlight?.show(null);
      this.arrow?.hide();
    } else {
      this.highlight.hide();
    }
  }

  private advance(state: TutorialGameState): void {
    if (this.scene) playStepCompleteEffect(this.scene, this.currentStep);
    this.currentStep++;
    if (this.currentStep >= TOTAL_STEPS) {
      this.complete();
      return;
    }
    this.events.clear();
    this.showStep(state);
  }

  skip(): void {
    localStorage.setItem(STORAGE_KEY, '1');
    this.active = false;
    this.box.destroy();
    this.highlight.hide();
    this.spotlight?.hide();
    this.arrow?.hide();
    this.panel?.hide();
  }

  private complete(): void {
    localStorage.setItem(STORAGE_KEY, '1');
    this.active = false;
    this.box.destroy();
    this.highlight.hide();
    this.spotlight?.hide();
    this.arrow?.hide();
    this.panel?.hide();
  }

  destroy(): void {
    this.box.destroy();
    this.highlight.hide();
    this.spotlight?.destroy();
    this.arrow?.destroy();
    this.panel?.destroy();
  }
}
