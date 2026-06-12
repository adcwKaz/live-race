import type { RaceContext, RaceController, ThemeModule } from './types';
import { SILKS_COLORS } from './palette';

const VW = 1280;
const VH = 720;
const CX = VW / 2;
const CY = VH / 2 + 14;
const R_WHEEL = 285;

type Phase = 'intro' | 'spin' | 'tease' | 'announce' | 'done';

const INTRO_SEC = 2.2;
const TEASE_SEC = 1.9;
const ANNOUNCE_SEC = 2.0;

/**
 * カジノルーレット演出。
 * 玉の最終停止位置=当選者ポケットを先に決め、減速カーブと
 * 「隣に行きそうで戻る」タメの振動を逆算して描画する。
 */
class RouletteSpin {
  private ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private lastTs = 0;
  private phase: Phase = 'intro';
  private phaseClock = 0;
  private spinTime: number;
  private endAngle: number;
  private totalTravel: number;
  private lastPocket = -1;
  private telopTimer: number | null = null;
  private resolveFinished!: () => void;
  finished: Promise<void>;

  constructor(private c: RaceContext) {
    this.ctx2d = c.canvas.getContext('2d')!;
    const n = c.names.length;
    const step = (Math.PI * 2) / n;
    // 玉は当選者ポケットの中心で止まる。回転数はレース時間設定に応じて増やす
    this.spinTime = Math.min(26, Math.max(6, c.script.duration * 0.55));
    this.endAngle = -Math.PI / 2 + c.script.winnerIndex * step;
    this.totalTravel = Math.PI * 2 * (5 + this.spinTime / 2.5);
    this.finished = new Promise((res) => (this.resolveFinished = res));
  }

  start(): void {
    this.c.audio.fanfare();
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  skip(): void {
    if (this.phase === 'done') return;
    this.setPhase('done');
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    if (this.telopTimer !== null) clearTimeout(this.telopTimer);
    this.c.audio.stopAll();
  }

  private telop(text: string, hideAfter = 2.2): void {
    this.c.onTelop(text);
    if (this.telopTimer !== null) clearTimeout(this.telopTimer);
    this.telopTimer = window.setTimeout(() => this.c.onTelop(null), hideAfter * 1000);
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseClock = 0;
    const { audio, names, script } = this.c;
    if (p === 'spin') {
      audio.startSignal();
      audio.startBgm('roulette');
      this.telop('運命のスピン!!');
    }
    if (p === 'tease') {
      audio.stopBgm();
      audio.drumroll(TEASE_SEC);
      this.telop('止まりそうだ・・・!');
    }
    if (p === 'announce') {
      audio.ding();
      audio.crowd(3);
      this.telop(`当選 ${names[script.winnerIndex]}!!`);
    }
    if (p === 'done') {
      this.stop();
      this.c.onTelop(null);
      this.resolveFinished();
    }
  }

  private loop = (ts: number): void => {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.phaseClock += dt;

    switch (this.phase) {
      case 'intro':
        if (this.phaseClock >= INTRO_SEC) this.setPhase('spin');
        break;
      case 'spin':
        if (this.phaseClock >= this.spinTime) this.setPhase('tease');
        break;
      case 'tease':
        if (this.phaseClock >= TEASE_SEC) this.setPhase('announce');
        break;
      case 'announce':
        if (this.phaseClock >= ANNOUNCE_SEC) this.setPhase('done');
        break;
    }

    this.draw();
    if (this.phase !== 'done') this.raf = requestAnimationFrame(this.loop);
  };

  /** 現在の玉の角度。spin中は減速カーブ、teaseでは減衰振動 */
  private ballAngle(): number {
    if (this.phase === 'intro') return this.endAngle - this.totalTravel;
    if (this.phase === 'spin') {
      const u = Math.min(1, this.phaseClock / this.spinTime);
      const ease = 1 - Math.pow(1 - u, 3);
      return this.endAngle - this.totalTravel * (1 - ease);
    }
    if (this.phase === 'tease') {
      const n = this.c.names.length;
      const step = (Math.PI * 2) / n;
      const t = this.phaseClock;
      // 隣のポケットへ行きかけて戻る減衰振動
      return this.endAngle + step * 0.85 * Math.exp(-1.8 * t) * Math.sin(6.5 * t + Math.PI * 0.9);
    }
    return this.endAngle;
  }

  /** 玉の軌道半径。終盤に外周からポケットへ落ちる */
  private ballRadius(): number {
    const rOut = R_WHEEL + 6;
    const rIn = R_WHEEL * 0.78;
    if (this.phase === 'intro') return rOut;
    if (this.phase === 'spin') {
      const u = Math.min(1, this.phaseClock / this.spinTime);
      const drop = Math.min(1, Math.max(0, (u - 0.6) / 0.4));
      return rOut - (rOut - rIn) * drop * drop;
    }
    return rIn;
  }

  private currentPocket(): number {
    const n = this.c.names.length;
    const step = (Math.PI * 2) / n;
    const a = this.ballAngle() + Math.PI / 2 + step / 2;
    return ((Math.round(a / step) % n) + n) % n;
  }

  private draw(): void {
    const { canvas, names } = this.c;
    const g = this.ctx2d;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth * dpr;
    const ch = canvas.clientHeight * dpr;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0d3320'; // カジノテーブルの緑
    g.fillRect(0, 0, cw, ch);
    const s = Math.min(cw / VW, ch / VH);
    g.setTransform(s, 0, 0, s, (cw - VW * s) / 2, (ch - VH * s) / 2);

    const n = names.length;
    const step = (Math.PI * 2) / n;
    const pocket = this.currentPocket();

    // ポケット通過音
    if (pocket !== this.lastPocket && (this.phase === 'spin' || this.phase === 'tease')) {
      this.c.audio.tick();
      this.lastPocket = pocket;
    }

    // 外周リング
    g.fillStyle = '#c9a227';
    g.beginPath();
    g.arc(CX, CY, R_WHEEL + 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7a5c12';
    g.beginPath();
    g.arc(CX, CY, R_WHEEL + 10, 0, Math.PI * 2);
    g.fill();

    // ポケット(当選確定後は当選セグメントを点滅ハイライト)
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * step - step / 2;
      const isWinner = i === this.c.script.winnerIndex;
      const flash =
        (this.phase === 'announce' || this.phase === 'done') &&
        isWinner &&
        Math.floor(this.phaseClock * 6) % 2 === 0;
      g.fillStyle = flash ? '#ffe97a' : SILKS_COLORS[i % SILKS_COLORS.length];
      g.beginPath();
      g.moveTo(CX, CY);
      g.arc(CX, CY, R_WHEEL, a0, a0 + step);
      g.closePath();
      g.fill();
      g.strokeStyle = '#1a1d29';
      g.lineWidth = 2;
      g.stroke();
    }

    // 名前(放射状に描画、左半分は反転して読みやすく)
    g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step;
      const light = SILKS_COLORS[i % SILKS_COLORS.length] === '#f5f5f5' || SILKS_COLORS[i % SILKS_COLORS.length] === '#f2d022';
      g.save();
      g.translate(CX, CY);
      g.rotate(a);
      const fontSize = Math.min(24, Math.max(13, R_WHEEL * step * 0.42));
      g.font = `bold ${fontSize}px sans-serif`;
      g.fillStyle = light ? '#222' : '#fff';
      const label = names[i];
      const maxW = R_WHEEL * 0.52;
      const w = Math.min(g.measureText(label).width, maxW);
      if (Math.cos(a) >= 0) {
        g.textAlign = 'right';
        g.fillText(label, R_WHEEL * 0.92, 0, maxW);
      } else {
        g.rotate(Math.PI);
        g.textAlign = 'left';
        g.fillText(label, -R_WHEEL * 0.92, 0, maxW);
      }
      void w;
      g.restore();
    }

    // 中央ハブ: 玉が乗っているポケットの名前を出してじらす
    g.fillStyle = '#1a1d29';
    g.beginPath();
    g.arc(CX, CY, R_WHEEL * 0.42, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c9a227';
    g.lineWidth = 4;
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (this.phase !== 'intro') {
      g.fillStyle = '#9aa0b5';
      g.font = '16px sans-serif';
      g.fillText(this.phase === 'announce' || this.phase === 'done' ? '🎉 WINNER 🎉' : '・・・', CX, CY - 34);
      g.fillStyle = '#ffd54a';
      g.font = `bold ${R_WHEEL * 0.13}px sans-serif`;
      g.fillText(names[pocket], CX, CY + 6, R_WHEEL * 0.7);
    } else {
      g.fillStyle = '#ffd54a';
      g.font = 'bold 30px sans-serif';
      g.fillText('ROULETTE', CX, CY - 12);
      g.fillStyle = '#9aa0b5';
      g.font = '15px sans-serif';
      g.fillText(`エントリー ${n}名`, CX, CY + 24);
    }

    // 玉
    const ba = this.ballAngle();
    const br = this.ballRadius();
    g.fillStyle = '#f5f5f5';
    g.beginPath();
    g.arc(CX + Math.cos(ba) * br, CY + Math.sin(ba) * br, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#999';
    g.lineWidth = 1;
    g.stroke();

    g.textAlign = 'start';
    g.textBaseline = 'alphabetic';
  }
}

export const rouletteTheme: ThemeModule = {
  id: 'roulette',
  name: 'ルーレット',
  icon: '🎰',
  maxLanes: 100,
  available: true,
  run(ctx: RaceContext): RaceController {
    const spin = new RouletteSpin(ctx);
    spin.start();
    return { finished: spin.finished, skip: () => spin.skip(), stop: () => spin.stop() };
  },
};
