export type BGMTheme = 'dawn' | 'morning' | 'day' | 'evening' | 'night' | 'invasion' | 'frenzy' | 'title' | 'none';

const SCALES: Record<string, number[]> = {
  morning: [261.63, 293.66, 329.63, 392.00, 440.00],         // C메이저 펜타토닉
  day:     [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88], // C메이저
  evening: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00], // A마이너
  night:   [246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 415.30], // B로크리안
  frenzy:  [220.00, 233.08, 246.94, 261.63, 277.18],         // 반음 클러스터
  dawn:    [130.81, 196.00, 261.63, 349.23, 523.25],         // C저음 드론 스케일
  title:   [261.63, 329.63, 392.00, 523.25],                 // C메이저 코드
};

export class BGMGenerator {
  private currentTheme: BGMTheme = 'none';
  private droneNodes: OscillatorNode[] = [];
  private melodyTimeout: ReturnType<typeof setTimeout> | null = null;
  private percTimeout: ReturnType<typeof setTimeout> | null = null;
  private bgmGain!: GainNode;
  private active = false;

  constructor(private ctx: AudioContext, private masterGain: GainNode) {
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.35;
    this.bgmGain.connect(this.masterGain);
  }

  setBGMVolume(v: number): void {
    this.bgmGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  switchTheme(theme: BGMTheme, fadeMs = 2000): void {
    if (theme === this.currentTheme) return;
    this.currentTheme = theme;

    const fadeTime = fadeMs / 1000;
    // Fade out current
    this.bgmGain.gain.setTargetAtTime(0, this.ctx.currentTime, fadeTime * 0.3);

    setTimeout(() => {
      this.stopAll();
      if (theme !== 'none') {
        this.bgmGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, fadeTime * 0.3);
        this.startTheme(theme);
      }
    }, fadeMs);
  }

  private stopAll(): void {
    this.active = false;
    this.droneNodes.forEach(n => { try { n.stop(); n.disconnect(); } catch { /* ignore */ } });
    this.droneNodes = [];
    if (this.melodyTimeout) clearTimeout(this.melodyTimeout);
    if (this.percTimeout) clearTimeout(this.percTimeout);
    this.melodyTimeout = null;
    this.percTimeout = null;
  }

  private startTheme(theme: BGMTheme): void {
    this.active = true;
    switch (theme) {
      case 'dawn':    this.playDawn(); break;
      case 'morning': this.playMorning(); break;
      case 'day':     this.playDay(); break;
      case 'evening': this.playEvening(); break;
      case 'night':   this.playNight(); break;
      case 'invasion':this.playInvasion(); break;
      case 'frenzy':  this.playFrenzy(); break;
      case 'title':   this.playTitle(); break;
    }
  }

  private playDrone(freq: number, duration: number, volume = 0.08, type: OscillatorType = 'sine'): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 1);
    gain.gain.setTargetAtTime(0, this.ctx.currentTime + duration - 1, 0.5);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    this.droneNodes.push(osc);
  }

  private scheduleMelodyNote(scale: number[], idx: number, interval: number): void {
    if (!this.active) return;
    const freq = scale[idx % scale.length];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + interval * 0.7);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start();
    osc.stop(this.ctx.currentTime + interval);

    this.melodyTimeout = setTimeout(() => {
      if (!this.active) return;
      this.scheduleMelodyNote(scale, idx + 1, interval);
    }, interval * 1000);
  }

  private scheduleNoisePerc(bpm: number, pattern: boolean[]): void {
    if (!this.active) return;
    const beatMs = (60 / bpm) * 1000;
    let step = 0;
    const tick = () => {
      if (!this.active) return;
      if (pattern[step % pattern.length]) {
        const buf = this.ctx.createBuffer(1, Math.floor(0.05 * this.ctx.sampleRate), this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = 0.08;
        src.connect(g);
        g.connect(this.bgmGain);
        src.start();
      }
      step++;
      this.percTimeout = setTimeout(tick, beatMs);
    };
    tick();
  }

  private playDawn(): void {
    this.playDrone(65.41, 16, 0.1, 'sine');   // C2
    this.playDrone(130.81, 16, 0.06, 'sine');  // C3
    const reschedule = () => {
      if (!this.active) return;
      const scale = SCALES.dawn;
      const freq = scale[Math.floor(Math.random() * scale.length)] * 2;
      this.playDrone(freq, 4, 0.06, 'sine');
      this.melodyTimeout = setTimeout(reschedule, 4000 + Math.random() * 4000);
    };
    setTimeout(reschedule, 2000);
  }

  private playMorning(): void {
    this.scheduleNoisePerc(90, [true, false, false, false, true, false, false, false]);
    this.scheduleMelodyNote(SCALES.morning, 0, 0.45);
  }

  private playDay(): void {
    this.playDrone(130.81, 12, 0.05, 'sine');
    this.scheduleMelodyNote(SCALES.day, 2, 0.38);
  }

  private playEvening(): void {
    this.scheduleNoisePerc(100, [true, false, false, true, false, false, true, false]);
    this.scheduleMelodyNote(SCALES.evening, 0, 0.35);
    this.playDrone(110, 12, 0.07, 'sawtooth');
  }

  private playNight(): void {
    this.playDrone(82.41, 12, 0.1, 'sawtooth'); // low E
    this.scheduleNoisePerc(80, [true, false, true, false, false, true, false, false]);
    this.scheduleMelodyNote(SCALES.night, 0, 0.5);
  }

  private playInvasion(): void {
    this.scheduleNoisePerc(130, [true, false, true, true, false, true, false, true]);
    this.playDrone(82.41, 8, 0.12, 'sawtooth');
    this.scheduleMelodyNote(SCALES.night, 4, 0.25);
  }

  private playFrenzy(): void {
    this.scheduleNoisePerc(160, [true, true, false, true, true, false, true, false]);
    this.playDrone(110, 8, 0.15, 'sawtooth');
    this.scheduleMelodyNote(SCALES.frenzy, 0, 0.18);
  }

  private playTitle(): void {
    this.playDrone(130.81, 16, 0.1, 'sine');
    this.scheduleMelodyNote(SCALES.title, 0, 0.6);
  }

  destroy(): void {
    this.stopAll();
  }
}
