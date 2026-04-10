/**
 * Web Audio API 기반 절차적 사운드 생성기
 * 외부 파일 없이 AudioBuffer를 코드로 생성
 */
export class SoundGenerator {
  constructor(private ctx: AudioContext) {}

  /** ADSR 엔벨로프 적용 gain 배열 생성 */
  private makeEnvelope(
    frames: number,
    sampleRate: number,
    attack: number,  // seconds
    decay: number,
    sustain: number, // 0~1
    release: number,
  ): Float32Array {
    const env = new Float32Array(frames);
    const a = Math.floor(attack * sampleRate);
    const d = Math.floor(decay  * sampleRate);
    const r = Math.floor(release * sampleRate);
    const s = frames - a - d - r;
    for (let i = 0; i < frames; i++) {
      if (i < a) {
        env[i] = i / a;
      } else if (i < a + d) {
        env[i] = 1 - (1 - sustain) * ((i - a) / d);
      } else if (i < a + d + Math.max(0, s)) {
        env[i] = sustain;
      } else {
        const ri = i - (a + d + Math.max(0, s));
        env[i] = sustain * (1 - ri / r);
      }
    }
    return env;
  }

  /** 사인파 AudioBuffer 생성 */
  createTone(
    freq: number,
    duration: number,
    type: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine',
    a = 0.01, d = 0.05, sus = 0.7, r = 0.1,
  ): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const frames = Math.floor(duration * sr);
    const buf = this.ctx.createBuffer(1, frames, sr);
    const data = buf.getChannelData(0);
    const env = this.makeEnvelope(frames, sr, a, d, sus, r);
    for (let i = 0; i < frames; i++) {
      const t = i / sr;
      let sample = 0;
      if (type === 'sine')     sample = Math.sin(2 * Math.PI * freq * t);
      else if (type === 'sawtooth') sample = 2 * (t * freq % 1) - 1;
      else if (type === 'triangle') sample = 2 * Math.abs(2 * (t * freq % 1) - 1) - 1;
      else if (type === 'square')   sample = Math.sign(Math.sin(2 * Math.PI * freq * t));
      data[i] = sample * env[i];
    }
    return buf;
  }

  /** 화이트/핑크 노이즈 AudioBuffer 생성 */
  createNoise(
    duration: number,
    color: 'white' | 'pink' = 'white',
    a = 0.005, d = 0.05, sus = 0.6, r = 0.1,
  ): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const frames = Math.floor(duration * sr);
    const buf = this.ctx.createBuffer(1, frames, sr);
    const data = buf.getChannelData(0);
    const env = this.makeEnvelope(frames, sr, a, d, sus, r);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1;
      if (color === 'pink') {
        // Paul Kellet's pink noise algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
        data[i] = pink * env[i];
      } else {
        data[i] = white * env[i];
      }
    }
    return buf;
  }

  /** 주파수 스윕 AudioBuffer 생성 */
  createSweep(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: 'sine' | 'sawtooth' | 'noise' = 'sine',
    a = 0.01, r = 0.1,
  ): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const frames = Math.floor(duration * sr);
    const buf = this.ctx.createBuffer(1, frames, sr);
    const data = buf.getChannelData(0);
    const env = this.makeEnvelope(frames, sr, a, 0, 1, r);

    let phase = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      const freq = freqStart + (freqEnd - freqStart) * t;
      const phaseInc = (2 * Math.PI * freq) / sr;
      phase += phaseInc;
      let sample: number;
      if (type === 'noise') {
        sample = (Math.random() * 2 - 1);
        // simple bandpass: just use the envelope
      } else if (type === 'sawtooth') {
        sample = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
      } else {
        sample = Math.sin(phase);
      }
      data[i] = sample * env[i];
    }
    return buf;
  }

  /** 아르페지오 (순차 톤) AudioBuffer 생성 */
  createArpeggio(freqs: number[], noteDuration: number, type: 'sine' | 'triangle' = 'sine'): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const noteFrames = Math.floor(noteDuration * sr);
    const totalFrames = noteFrames * freqs.length;
    const buf = this.ctx.createBuffer(1, totalFrames, sr);
    const data = buf.getChannelData(0);

    for (let n = 0; n < freqs.length; n++) {
      const freq = freqs[n];
      const env = this.makeEnvelope(noteFrames, sr, 0.01, 0.02, 0.7, 0.06);
      for (let i = 0; i < noteFrames; i++) {
        const t = i / sr;
        const sample = type === 'triangle'
          ? 2 * Math.abs(2 * (t * freq % 1) - 1) - 1
          : Math.sin(2 * Math.PI * freq * t);
        data[n * noteFrames + i] = sample * env[i];
      }
    }
    return buf;
  }

  /** 다중 노이즈 버스트 (채굴 완료 등) */
  createNoiseBursts(count: number, burstDuration: number, intervalMs: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const burstFrames = Math.floor(burstDuration * sr);
    const intervalFrames = Math.floor((intervalMs / 1000) * sr);
    const totalFrames = burstFrames * count + intervalFrames * (count - 1);
    const buf = this.ctx.createBuffer(1, totalFrames, sr);
    const data = buf.getChannelData(0);

    for (let b = 0; b < count; b++) {
      const offset = b * (burstFrames + intervalFrames);
      const env = this.makeEnvelope(burstFrames, sr, 0.001, 0.03, 0.4, 0.05);
      for (let i = 0; i < burstFrames && offset + i < totalFrames; i++) {
        data[offset + i] = (Math.random() * 2 - 1) * env[i];
      }
    }
    return buf;
  }
}
