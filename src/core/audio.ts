/**
 * 音響エンジン。
 * 効果音はすべてWeb Audio APIで合成する(音源ファイル不要)。
 * BGMは public/bgm/<テーマID>.mp3 があればそれを再生し、
 * 無ければテーマ別のチップチューン風自動生成ループにフォールバックする。
 */

export type AmbientKind = 'gallop' | 'engine' | 'water' | 'steps';

interface ChiptunePattern {
  bpm: number;
  lead: Array<number | null>;
  bass: Array<number | null>;
}

/** テーマ別チップチューン(MIDIノート番号、nullは休符、2小節=32ステップ) */
const CHIPTUNE: Record<string, ChiptunePattern> = {
  keiba: {
    bpm: 152,
    lead: [
      72, null, 76, null, 79, null, 76, null, 72, null, 76, null, 81, 79, 76, null,
      74, null, 77, null, 81, null, 77, null, 79, null, 76, null, 72, null, null, null,
    ],
    bass: [
      48, null, 48, null, 55, null, 48, null, 53, null, 53, null, 55, null, 55, null,
      50, null, 50, null, 57, null, 50, null, 55, null, 55, null, 48, null, 48, null,
    ],
  },
  car: {
    bpm: 168,
    lead: [
      64, null, 64, 67, null, 67, 71, null, 71, null, 69, 67, 64, null, 62, null,
      64, null, 64, 67, null, 67, 71, null, 74, 72, 71, 69, 67, null, 64, null,
    ],
    bass: [
      40, 40, null, 40, 40, null, 40, null, 43, 43, null, 43, 43, null, 43, null,
      45, 45, null, 45, 45, null, 45, null, 47, 47, null, 47, 43, null, 40, null,
    ],
  },
  duck: {
    bpm: 116,
    lead: [
      72, null, null, 76, null, null, 79, null, 76, null, 72, null, 74, null, 71, null,
      72, null, null, 76, null, null, 81, null, 79, null, 76, null, 72, null, null, null,
    ],
    bass: [
      48, null, 52, null, 55, null, 52, null, 53, null, 57, null, 55, null, 52, null,
      48, null, 52, null, 55, null, 52, null, 43, null, 47, null, 48, null, null, null,
    ],
  },
  marathon: {
    bpm: 144,
    lead: [
      65, null, 69, null, 72, null, 69, null, 65, null, 69, null, 74, 72, 69, null,
      67, null, 70, null, 74, null, 70, null, 72, null, 69, null, 65, null, null, null,
    ],
    bass: [
      41, null, 41, null, 48, null, 41, null, 46, null, 46, null, 53, null, 46, null,
      43, null, 43, null, 50, null, 43, null, 48, null, 48, null, 41, null, 41, null,
    ],
  },
  golf: {
    bpm: 100,
    lead: [
      67, null, null, null, 72, null, null, null, 71, null, 67, null, 64, null, null, null,
      65, null, null, null, 69, null, null, null, 67, null, 64, null, 60, null, null, null,
    ],
    bass: [
      48, null, null, 52, null, null, 55, null, 48, null, null, 52, null, null, 55, null,
      45, null, null, 48, null, null, 53, null, 43, null, null, 47, null, null, 48, null,
    ],
  },
  roulette: {
    bpm: 116,
    lead: [
      69, null, 72, null, 76, null, 75, 76, 72, null, 69, null, null, null, null, null,
      68, null, 71, null, 74, null, 73, 74, 71, null, 68, null, null, null, null, null,
    ],
    bass: [
      45, null, null, 48, null, null, 52, null, 45, null, null, 48, null, null, 52, null,
      44, null, null, 47, null, null, 51, null, 40, null, null, 43, null, null, 47, null,
    ],
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private volume = 0.7;
  private muted = false;

  private bgmAudio: HTMLAudioElement | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private bgmNextTime = 0;
  private ambientTimer: number | null = null;
  private ambientNodes: AudioNode[] = [];
  private lastTickAt = 0;

  /** ユーザー操作を起点に呼ぶ(ブラウザの自動再生制限の解除) */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.5;
      this.bgmGain.connect(this.master);
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  private applyVolume(): void {
    const v = this.muted ? 0 : this.volume;
    if (this.master) this.master.gain.value = v;
    if (this.bgmAudio) this.bgmAudio.volume = v * 0.5;
  }

  private get ready(): boolean {
    return !!this.ctx && !!this.master;
  }

  // ---------- 基本波形 ----------

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType = 'square',
    gain = 0.18,
    dest?: AudioNode,
  ): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g).connect(dest ?? this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, filterFreq: number, gain = 0.2): void {
    if (!this.ctx || !this.master) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(start);
  }

  // ---------- 単発効果音 ----------

  /** 出走ファンファーレ(オリジナルの短いメロディ)。所要時間(秒)を返す */
  fanfare(): number {
    if (!this.ready) return 0;
    const t0 = this.ctx!.currentTime + 0.05;
    const C4 = 261.63, E4 = 329.63, G4 = 392.0, C5 = 523.25, E5 = 659.26, G5 = 783.99;
    const seq: Array<[number, number, number]> = [
      [C4, 0.0, 0.18], [E4, 0.2, 0.18], [G4, 0.4, 0.18], [C5, 0.6, 0.35],
      [G4, 1.0, 0.18], [C5, 1.2, 0.18], [E5, 1.4, 0.18], [G5, 1.6, 0.7],
    ];
    for (const [f, at, dur] of seq) {
      this.tone(f, t0 + at, dur, 'square', 0.14);
      this.tone(f / 2, t0 + at, dur, 'triangle', 0.12);
    }
    return 2.6;
  }

  /** スタート合図 */
  startSignal(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(880, t, 0.1, 'square', 0.2);
    this.tone(1760, t + 0.12, 0.4, 'square', 0.2);
  }

  /** 最終コーナーの鐘(ジャンジャン) */
  bell(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 6; i++) {
      this.tone(1568, t + i * 0.15, 0.12, 'square', 0.12);
      this.tone(2349, t + i * 0.15, 0.12, 'square', 0.08);
    }
  }

  /** 歓声(ノイズのうねり) */
  crowd(dur = 3): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < dur * 4; i++) {
      this.noise(t + i * 0.25, 0.5, 800 + Math.random() * 1200, 0.05);
    }
  }

  /** 写真判定などのドラムロール */
  drumroll(dur: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const interval = 0.045;
    for (let i = 0; i < dur / interval; i++) {
      this.noise(t + i * interval, 0.04, 300, 0.12);
    }
  }

  /** ルーレットの玉がポケットを通過するカチ音(連打防止つき) */
  tick(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    if (t - this.lastTickAt < 0.025) return;
    this.lastTickAt = t;
    this.tone(2400, t, 0.025, 'square', 0.09);
    this.noise(t, 0.02, 4000, 0.06);
  }

  /** ゴルフのスイング(ヒュッ+カキーン) */
  swing(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.12, 2500, 0.12); // 素振りの風切り
    this.tone(2093, t + 0.13, 0.25, 'square', 0.16); // インパクト
    this.tone(3136, t + 0.13, 0.18, 'square', 0.1);
    this.noise(t + 0.13, 0.05, 5000, 0.1);
  }

  /** ボールが芝に落ちるバウンド音 */
  bounce(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.06, 250, 0.1);
  }

  /** カップイン(カコン!) */
  cupIn(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(520, t, 0.07, 'square', 0.18);
    this.tone(330, t + 0.08, 0.18, 'square', 0.16);
    this.noise(t + 0.08, 0.1, 400, 0.1);
  }

  /** 当選ベル(チーン) */
  ding(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(1318.5, t, 0.7, 'triangle', 0.2);
    this.tone(1760, t + 0.02, 0.9, 'triangle', 0.14);
  }

  /** 勝利ジングル */
  goalFanfare(): void {
    if (!this.ready) return;
    const t0 = this.ctx!.currentTime + 0.05;
    const C5 = 523.25, D5 = 587.33, E5 = 659.26, G5 = 783.99, C6 = 1046.5;
    const seq: Array<[number, number, number]> = [
      [C5, 0.0, 0.12], [D5, 0.14, 0.12], [E5, 0.28, 0.12], [G5, 0.42, 0.3],
      [E5, 0.8, 0.15], [G5, 1.0, 0.15], [C6, 1.2, 1.0],
    ];
    for (const [f, at, dur] of seq) {
      this.tone(f, t0 + at, dur, 'square', 0.15);
      this.tone(f * 1.005, t0 + at, dur, 'square', 0.08); // デチューンで厚みを出す
      this.tone(f / 2, t0 + at, dur, 'triangle', 0.12);
    }
    this.crowd(3);
  }

  // ---------- 環境音ループ ----------

  ambientStart(kind: AmbientKind): void {
    this.ambientStop();
    if (!this.ready) return;
    if (kind === 'engine') {
      this.startEngineDrone();
      return;
    }
    // パターン系(蹄・水しぶき・足音)はスケジューラで回す
    const pattern: Record<Exclude<AmbientKind, 'engine'>, { beat: number; hits: number[]; freq: number; gain: number; dur: number }> = {
      gallop: { beat: 0.42, hits: [0, 0.09, 0.18], freq: 180, gain: 0.08, dur: 0.05 },
      water: { beat: 0.5, hits: [0, 0.25], freq: 1100, gain: 0.05, dur: 0.18 },
      steps: { beat: 0.28, hits: [0, 0.14], freq: 500, gain: 0.06, dur: 0.04 },
    };
    const p = pattern[kind];
    let next = this.ctx!.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.5) {
        for (const off of p.hits) this.noise(next + off, p.dur, p.freq, p.gain);
        next += p.beat;
      }
    };
    schedule();
    this.ambientTimer = window.setInterval(schedule, 200);
  }

  /** エンジン音: のこぎり波ドローン+ピッチ揺らぎ */
  private startEngineDrone(): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 85;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    osc.connect(filter).connect(g).connect(this.master!);
    osc.start();
    lfo.start();
    this.ambientNodes = [osc, lfo, g];
  }

  ambientStop(): void {
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    for (const node of this.ambientNodes) {
      if (node instanceof OscillatorNode) node.stop();
      node.disconnect();
    }
    this.ambientNodes = [];
  }

  // ---------- BGM ----------

  startBgm(themeId: string): void {
    this.stopBgm();
    const url = `${import.meta.env.BASE_URL}bgm/${themeId}.mp3`;
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = (this.muted ? 0 : this.volume) * 0.5;
    audio
      .play()
      .then(() => {
        this.bgmAudio = audio;
      })
      .catch(() => {
        // 音源ファイルが無い/再生不可 → チップチューン生成にフォールバック
        this.startChiptune(themeId);
      });
    audio.addEventListener('error', () => {
      if (this.bgmAudio === audio) this.bgmAudio = null;
      this.startChiptune(themeId);
    });
  }

  stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /** チップチューン風BGMループ(16分音符のステップシーケンサ) */
  private startChiptune(themeId: string): void {
    if (!this.ready || this.bgmTimer !== null) return;
    const pattern = CHIPTUNE[themeId] ?? CHIPTUNE.keiba;
    const step16 = 60 / pattern.bpm / 4;
    const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    this.bgmStep = 0;
    this.bgmNextTime = this.ctx!.currentTime + 0.1;

    const schedule = () => {
      if (!this.ctx || !this.bgmGain) return;
      while (this.bgmNextTime < this.ctx.currentTime + 0.3) {
        const s = this.bgmStep % pattern.lead.length;
        const t = this.bgmNextTime;
        const l = pattern.lead[s];
        if (l !== null) this.tone(midi(l), t, step16 * 1.8, 'square', 0.06, this.bgmGain);
        const b = pattern.bass[s];
        if (b !== null) this.tone(midi(b), t, step16 * 1.6, 'triangle', 0.12, this.bgmGain);
        if (s % 2 === 0) this.noise(t, 0.03, 6000, 0.025); // ハイハット
        this.bgmStep++;
        this.bgmNextTime += step16;
      }
    };
    schedule();
    this.bgmTimer = window.setInterval(schedule, 100);
  }

  /** レース終了時など全停止 */
  stopAll(): void {
    this.stopBgm();
    this.ambientStop();
  }
}
