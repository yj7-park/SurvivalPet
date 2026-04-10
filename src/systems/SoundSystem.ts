import { SoundGenerator } from './SoundGenerator';
import { BGMGenerator, BGMTheme } from './BGMGenerator';
import { GameTime } from './GameTime';

export type SoundId =
  | 'woodcut_hit' | 'woodcut_done' | 'mine_hit' | 'mine_done'
  | 'fish_start' | 'fish_success' | 'fish_fail'
  | 'attack_melee' | 'attack_bow' | 'hit_arrow' | 'block'
  | 'enemy_die' | 'player_hit' | 'player_die'
  | 'btn_click' | 'inv_open' | 'item_pickup' | 'levelup'
  | 'build_done' | 'build_destroy' | 'frenzy_start' | 'frenzy_end'
  | 'sleep_start' | 'wake_up' | 'alert'
  | 'door_open' | 'door_close' | 'thunder';

export type GameSituation = 'normal' | 'invasion' | 'frenzy';

const MAX_CONCURRENT = 4;

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private generator: SoundGenerator | null = null;
  private bgm: BGMGenerator | null = null;

  private masterGain!: GainNode;
  private sfxGain!: GainNode;

  // Pre-generated sound buffers
  private buffers = new Map<SoundId, AudioBuffer>();

  // Active source nodes for limiting concurrency
  private activeSources: AudioBufferSourceNode[] = [];

  private ready = false;
  private muteOnHide = true;
  private savedMasterVolume = 0.7;

  // Volume settings
  private _masterVolume = 0.7;
  private _sfxVolume = 0.8;
  private _bgmVolume = 0.4;

  async init(): Promise<void> {
    if (this.ready) return;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await this.ctx.resume();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.generator = new SoundGenerator(this.ctx);
      this.bgm = new BGMGenerator(this.ctx, this.masterGain);
      this.bgm.setBGMVolume(this._bgmVolume);

      this.pregenerate();
      this.ready = true;

      // Mute when tab hidden
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          this.savedMasterVolume = this._masterVolume;
          this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        } else {
          this.masterGain.gain.setTargetAtTime(this.savedMasterVolume, this.ctx.currentTime, 0.1);
        }
      });
    } catch (e) {
      console.warn('[SoundSystem] init failed:', e);
    }
  }

  isReady(): boolean { return this.ready; }

  play(id: SoundId, opts: { volume?: number; pitch?: number } = {}): void {
    if (!this.ready || !this.ctx || !this.sfxGain) return;
    const buf = this.buffers.get(id);
    if (!buf) return;

    // Limit concurrent SFX
    this.activeSources = this.activeSources.filter(s => {
      try { return s.playbackRate !== undefined; } catch { return false; }
    });
    if (this.activeSources.length >= MAX_CONCURRENT) {
      const oldest = this.activeSources.shift();
      if (oldest) { try { oldest.stop(); } catch { /* ignore */ } }
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (opts.pitch && opts.pitch !== 1) src.playbackRate.value = opts.pitch;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = opts.volume ?? 1.0;
    src.connect(gainNode);
    gainNode.connect(this.sfxGain);
    src.start();
    src.onended = () => {
      const idx = this.activeSources.indexOf(src);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      gainNode.disconnect();
    };
    this.activeSources.push(src);
  }

  setBGMTheme(theme: BGMTheme, fadeMs = 2000): void {
    this.bgm?.switchTheme(theme, fadeMs);
  }

  updateBGMByGameTime(gameTime: GameTime, situation: GameSituation): void {
    if (!this.ready) return;
    const hour = gameTime.hour;
    let theme: BGMTheme;
    if (situation === 'frenzy') {
      theme = 'frenzy';
    } else if (situation === 'invasion') {
      theme = 'invasion';
    } else if (hour >= 0 && hour < 6) {
      theme = 'dawn';
    } else if (hour >= 6 && hour < 12) {
      theme = 'morning';
    } else if (hour >= 12 && hour < 18) {
      theme = 'day';
    } else if (hour >= 18 && hour < 22) {
      theme = 'evening';
    } else {
      theme = 'night';
    }
    this.setBGMTheme(theme, 3000);
  }

  setMasterVolume(v: number): void {
    this._masterVolume = v;
    this.savedMasterVolume = v;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05);
  }

  setSFXVolume(v: number): void {
    this._sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05);
  }

  setBGMVolume(v: number): void {
    this._bgmVolume = v;
    this.bgm?.setBGMVolume(v);
  }

  getMasterVolume(): number { return this._masterVolume; }
  getSFXVolume(): number { return this._sfxVolume; }
  getBGMVolume(): number { return this._bgmVolume; }

  silenceBGM(): void { this.bgm?.switchTheme('none', 500); }

  destroy(): void {
    this.bgm?.destroy();
    this.activeSources.forEach(s => { try { s.stop(); } catch { /* ignore */ } });
    this.activeSources = [];
    if (this.ctx) { void this.ctx.close(); }
    this.ready = false;
  }

  /** Pre-generate all sound buffers */
  private pregenerate(): void {
    const g = this.generator!;

    // Woodcutting
    this.buffers.set('woodcut_hit',  g.createNoise(0.15, 'pink', 0.001, 0.05, 0.4, 0.08));
    this.buffers.set('woodcut_done', g.createNoise(0.8, 'pink', 0.05, 0.1, 0.5, 0.4));

    // Mining
    this.buffers.set('mine_hit',  g.createNoise(0.1, 'white', 0.001, 0.03, 0.3, 0.06));
    this.buffers.set('mine_done', g.createNoiseBursts(3, 0.08, 60));

    // Fishing
    this.buffers.set('fish_start',   g.createSweep(200, 100, 0.3, 'sine', 0.02, 0.1));
    this.buffers.set('fish_success', g.createNoise(0.2, 'pink', 0.001, 0.04, 0.5, 0.1));
    this.buffers.set('fish_fail',    g.createTone(300, 0.2, 'triangle', 0.01, 0.02, 0.3, 0.15));

    // Combat
    this.buffers.set('attack_melee', g.createSweep(800, 200, 0.12, 'noise', 0.001, 0.05));
    this.buffers.set('attack_bow',   g.createTone(400, 0.08, 'triangle', 0.001, 0.02, 0.4, 0.04));
    this.buffers.set('hit_arrow',    g.createNoise(0.1, 'white', 0.001, 0.02, 0.3, 0.06));
    this.buffers.set('block',        g.createTone(1200, 0.15, 'sine', 0.001, 0.02, 0.5, 0.1));
    this.buffers.set('enemy_die',    g.createSweep(440, 660, 0.3, 'sine', 0.01, 0.1));
    this.buffers.set('player_hit',   g.createNoise(0.2, 'pink', 0.001, 0.04, 0.6, 0.1));
    this.buffers.set('player_die',   g.createSweep(300, 80, 1.2, 'sine', 0.05, 0.5));

    // UI
    this.buffers.set('btn_click',    g.createTone(800, 0.05, 'sine', 0.001, 0.01, 0.5, 0.02));
    this.buffers.set('inv_open',     g.createNoise(0.08, 'white', 0.001, 0.02, 0.3, 0.04));
    this.buffers.set('item_pickup',  g.createSweep(440, 660, 0.15, 'sine', 0.005, 0.06));
    this.buffers.set('levelup',      g.createArpeggio([523, 659, 784], 0.15, 'triangle'));
    this.buffers.set('alert',        g.createArpeggio([600, 600], 0.12, 'sine'));

    // Build
    this.buffers.set('build_done',    g.createArpeggio([200, 200], 0.1, 'sine'));
    this.buffers.set('build_destroy', g.createNoise(0.6, 'pink', 0.005, 0.1, 0.6, 0.3));

    // State sounds
    this.buffers.set('frenzy_start', g.createSweep(200, 80, 1.0, 'sawtooth', 0.1, 0.3));
    this.buffers.set('frenzy_end',   g.createSweep(300, 500, 0.5, 'sine', 0.05, 0.2));
    this.buffers.set('sleep_start',  g.createSweep(440, 220, 1.0, 'sine', 0.1, 0.5));
    this.buffers.set('wake_up',      g.createTone(880, 0.3, 'sine', 0.05, 0.05, 0.7, 0.15));
    this.buffers.set('door_open',    g.createSweep(300, 500, 0.3, 'sine', 0.01, 0.15));
    this.buffers.set('door_close',   g.createSweep(500, 250, 0.3, 'sine', 0.01, 0.15));
    this.buffers.set('thunder',      g.createNoise(0.9, 'pink', 0.001, 0.05, 0.8, 0.6));
  }
}
