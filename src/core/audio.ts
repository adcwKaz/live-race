/**
 * 音響エンジン。
 * 効果音はすべてWeb Audio APIで合成する(音源ファイル不要)。
 * BGMは public/bgm/<テーマID>.mp3 があればそれを再生し、
 * 無ければチップチューン風の自動生成ループにフォールバックする。
 */
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
  private gallopTimer: number | null = null;

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

  // ---------- 効果音 ----------

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

  /** 写真判定のドラムロール */
  drumroll(dur: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const interval = 0.045;
    for (let i = 0; i < dur / interval; i++) {
      this.noise(t + i * interval, 0.04, 300, 0.12);
    }
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

  /** 蹄音ループ開始(3連符のダダダッ) */
  gallopStart(): void {
    if (!this.ready || this.gallopTimer !== null) return;
    const beat = 0.42;
    let next = this.ctx!.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.5) {
        for (const off of [0, 0.09, 0.18]) {
          this.noise(next + off, 0.05, 180, 0.08);
        }
        next += beat;
      }
    };
    schedule();
    this.gallopTimer = window.setInterval(schedule, 200);
  }

  gallopStop(): void {
    if (this.gallopTimer !== null) {
      clearInterval(this.gallopTimer);
      this.gallopTimer = null;
    }
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
        this.startChiptune();
      });
    audio.addEventListener('error', () => {
      if (this.bgmAudio === audio) this.bgmAudio = null;
      this.startChiptune();
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
  private startChiptune(): void {
    if (!this.ready || this.bgmTimer !== null) return;
    const bpm = 152;
    const step16 = 60 / bpm / 4;
    // 2小節ループ。数値はMIDIノート、nullは休符
    const lead: Array<number | null> = [
      72, null, 76, null, 79, null, 76, null, 72, null, 76, null, 81, 79, 76, null,
      74, null, 77, null, 81, null, 77, null, 79, null, 76, null, 72, null, null, null,
    ];
    const bass: Array<number | null> = [
      48, null, 48, null, 55, null, 48, null, 53, null, 53, null, 55, null, 55, null,
      50, null, 50, null, 57, null, 50, null, 55, null, 55, null, 48, null, 48, null,
    ];
    const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    this.bgmStep = 0;
    this.bgmNextTime = this.ctx!.currentTime + 0.1;

    const schedule = () => {
      if (!this.ctx || !this.bgmGain) return;
      while (this.bgmNextTime < this.ctx.currentTime + 0.3) {
        const s = this.bgmStep % lead.length;
        const t = this.bgmNextTime;
        const l = lead[s];
        if (l !== null) this.tone(midi(l), t, step16 * 1.8, 'square', 0.06, this.bgmGain);
        const b = bass[s];
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
    this.gallopStop();
  }
}
