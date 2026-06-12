import type { RaceContext, RaceController, ThemeModule } from './types';
import { drawEntryList, renderPattern } from './sideRace';
import { rand } from '../core/lottery';

const VW = 1280;
const VH = 720;
const CUP = { x: 850, y: 470 }; // グリーン上のカップ位置(ワールド座標)

type Phase = 'intro' | 'tee' | 'flight' | 'green' | 'reveal' | 'done';

const INTRO_SEC = 3.0;
const TEE_SEC = 2.4;
const SWING_AT = 1.2;
const REVEAL_SEC = 2.6;
const TEETER_SEC = 1.3;

/** j=シャツ s=肌 d=パンツ/クラブ w=帽子 */
const GOLFER_A = [
  '....ww....',
  '....ss....',
  '...jjjj...',
  '..jjjjj...',
  '..jjjjjd..',
  '...jj..d..',
  '...dd...d.',
  '...dd...d.',
  '..d..d..d.',
  '..d..d.d..',
  '.ww..ww...',
];

const GOLFER_B = [
  '.d..ww....',
  '.d..ss....',
  '..djjjj...',
  '..jjjjj...',
  '..jjjj....',
  '...jj.....',
  '...dd.....',
  '...dd.....',
  '..d..d....',
  '..d..d....',
  '.ww..ww...',
];

interface Ball {
  delay: number; // 打ち出し/落下の時間差
  landX: number; // カップからの相対着地点
  landY: number;
  flightH: number;
}

/**
 * ゴルフ演出。
 * 全員のボールが一斉にティーショット→グリーンへ落下→
 * カメラが当選者のボールにどんどんズームし、カップ際で粘ってホールインワン。
 */
class GolfShot {
  private ctx2d: CanvasRenderingContext2D;
  private raf = 0;
  private lastTs = 0;
  private phase: Phase = 'intro';
  private phaseClock = 0;
  private flightSec: number;
  private greenSec: number;
  private balls: Ball[];
  private golfer: [HTMLCanvasElement, HTMLCanvasElement];
  private cupInPlayed = false;
  private teeterTelopDone = false;
  private telopTimer: number | null = null;
  private resolveFinished!: () => void;
  finished: Promise<void>;

  constructor(private c: RaceContext) {
    this.ctx2d = c.canvas.getContext('2d')!;
    const d = c.script.duration;
    this.flightSec = Math.max(2.5, d * 0.28);
    this.greenSec = Math.max(5, d * 0.5);
    this.balls = c.names.map((_, i) => {
      const a = rand() * Math.PI * 2;
      const r = 70 + rand() * 260;
      return {
        delay: rand() * 0.8,
        // 当選者のボールは転がしで寄せるため、着地はカップ右下のラフ気味に固定
        landX: i === c.script.winnerIndex ? 195 : Math.cos(a) * r,
        landY: i === c.script.winnerIndex ? 120 : Math.sin(a) * r * 0.55,
        flightH: 200 + rand() * 220,
      };
    });
    this.golfer = [
      renderPattern(GOLFER_A, { j: '#d24a3c', s: '#e8b88a', d: '#3a3f55', w: '#f5f0e8' }),
      renderPattern(GOLFER_B, { j: '#d24a3c', s: '#e8b88a', d: '#3a3f55', w: '#f5f0e8' }),
    ];
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
    if (p === 'tee') {
      audio.startBgm('golf');
      this.telop('第1打、ティーオフ!');
    }
    if (p === 'flight') this.telop('ボールは大空へ・・・!');
    if (p === 'green') this.telop('グリーンに乗った!');
    if (p === 'reveal') {
      audio.stopBgm();
      audio.ding();
      audio.crowd(3);
      this.telop(`ホールインワン!! ${names[script.winnerIndex]}!!`, 2.6);
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
    const prev = this.phaseClock;
    this.phaseClock += dt;

    switch (this.phase) {
      case 'intro':
        if (this.phaseClock >= INTRO_SEC) this.setPhase('tee');
        break;
      case 'tee':
        if (prev < SWING_AT && this.phaseClock >= SWING_AT) this.c.audio.swing();
        if (this.phaseClock >= TEE_SEC) this.setPhase('flight');
        break;
      case 'flight':
        if (this.phaseClock >= this.flightSec) this.setPhase('green');
        break;
      case 'green': {
        // 着地音(最初の8球まで)
        for (let i = 0; i < Math.min(8, this.balls.length); i++) {
          const at = this.balls[i].delay * (this.greenSec * 0.2);
          if (prev < at && this.phaseClock >= at) this.c.audio.bounce();
        }
        const teeterStart = this.greenSec - TEETER_SEC;
        if (!this.teeterTelopDone && this.phaseClock >= teeterStart) {
          this.teeterTelopDone = true;
          this.telop('入るか・・・!?');
          this.c.audio.drumroll(TEETER_SEC);
        }
        if (!this.cupInPlayed && this.phaseClock >= this.greenSec - 0.05) {
          this.cupInPlayed = true;
          this.c.audio.cupIn();
        }
        if (this.phaseClock >= this.greenSec) this.setPhase('reveal');
        break;
      }
      case 'reveal':
        if (this.phaseClock >= REVEAL_SEC) this.setPhase('done');
        break;
    }

    this.draw();
    if (this.phase !== 'done') this.raf = requestAnimationFrame(this.loop);
  };

  // ---------- 描画 ----------

  private draw(): void {
    const { canvas } = this.c;
    const g = this.ctx2d;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth * dpr;
    const ch = canvas.clientHeight * dpr;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, cw, ch);
    const s = Math.min(cw / VW, ch / VH);
    g.setTransform(s, 0, 0, s, (cw - VW * s) / 2, (ch - VH * s) / 2);
    g.imageSmoothingEnabled = false;

    if (this.phase === 'intro') {
      this.drawSky(g);
      drawEntryList(g, this.c.names, 'エントリー');
      return;
    }
    if (this.phase === 'tee' || this.phase === 'flight') {
      this.drawSky(g);
      this.drawTeeAndFlight(g);
      return;
    }
    if (this.phase === 'green') {
      this.drawGreen(g);
      return;
    }
    this.drawReveal(g);
  }

  private drawSky(g: CanvasRenderingContext2D): void {
    const sky = g.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, '#6cb8e8');
    sky.addColorStop(0.7, '#cfe9f5');
    sky.addColorStop(0.71, '#3f9c40');
    sky.addColorStop(1, '#2e7d32');
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, VH);
    // 雲
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [cx, cy, r] of [[220, 110, 38], [620, 70, 30], [1020, 140, 44]] as const) {
      g.beginPath();
      g.ellipse(cx, cy, r * 1.9, r, 0, 0, Math.PI * 2);
      g.ellipse(cx + r, cy - 10, r * 1.3, r * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawTeeAndFlight(g: CanvasRenderingContext2D): void {
    const n = this.c.names.length;
    // ゴルファー
    const swung = this.phase !== 'tee' || this.phaseClock >= SWING_AT;
    const spr = this.golfer[swung ? 1 : 0];
    g.drawImage(spr, 80, VH * 0.71 - 110, 110, 121);

    if (this.phase === 'tee' && this.phaseClock < SWING_AT) return;

    // 打ち出されたボールの放物線(フライト進行 0..1)
    const t = this.phase === 'tee' ? (this.phaseClock - SWING_AT) / this.flightSec : (this.phaseClock + (TEE_SEC - SWING_AT)) / this.flightSec;
    g.textAlign = 'left';
    g.font = 'bold 11px sans-serif';
    for (let i = 0; i < n; i++) {
      const b = this.balls[i];
      const u = Math.min(1, Math.max(0, t - b.delay * 0.3));
      if (u <= 0) continue;
      const x = 170 + u * (VW + 100);
      const y = VH * 0.71 - 90 - Math.sin(Math.min(1, u) * Math.PI * 0.9) * b.flightH;
      g.fillStyle = '#f5f5f5';
      g.beginPath();
      g.arc(x, y, n > 40 ? 3 : 5, 0, Math.PI * 2);
      g.fill();
      if (n <= 16) {
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillText(this.c.names[i], x + 8, y + 4);
      }
    }
  }

  /** イージング付きズーム。グリーンフェーズで 1.0 → 4.2 倍 */
  private zoomLevel(): number {
    const u = Math.min(1, this.phaseClock / (this.greenSec * 0.92));
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    return 1 + 3.2 * e;
  }

  private worldToScreen(z: number): (wx: number, wy: number) => [number, number] {
    // z=1で素のシーン、ズームに連れて注視点をカップへ寄せる
    const k = (z - 1) / 3.2;
    const tx = 640 + (CUP.x - 640) * k;
    const ty = 360 + (CUP.y - 360) * k;
    return (wx, wy) => [(wx - tx) * z + 640, (wy - ty) * z + 360];
  }

  private drawGreen(g: CanvasRenderingContext2D): void {
    const n = this.c.names.length;
    const z = this.zoomLevel();
    const w2s = this.worldToScreen(z);

    // 芝(刈り目ストライプ)
    g.fillStyle = '#3f9c40';
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    const stripe = 80 * z;
    const [, oy] = w2s(0, 0);
    for (let y = (oy % (stripe * 2)) - stripe * 2; y < VH; y += stripe * 2) {
      g.fillRect(0, y, VW, stripe);
    }

    // カップと旗
    const [cx, cy] = w2s(CUP.x, CUP.y);
    g.fillStyle = '#1d3a1d';
    g.beginPath();
    g.ellipse(cx, cy, 13 * z, 6 * z, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e8e0c8';
    g.lineWidth = Math.max(2, 2.5 * z);
    g.beginPath();
    g.moveTo(cx, cy - 2 * z);
    g.lineTo(cx, cy - 90 * z);
    g.stroke();
    g.fillStyle = '#e6332a';
    g.beginPath();
    g.moveTo(cx, cy - 90 * z);
    g.lineTo(cx + 42 * z, cy - 76 * z);
    g.lineTo(cx, cy - 62 * z);
    g.closePath();
    g.fill();

    // ボール着地と転がし
    const landWindow = this.greenSec * 0.2;
    const teeterStart = this.greenSec - TEETER_SEC;
    const winner = this.c.script.winnerIndex;
    g.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const b = this.balls[i];
      let wx: number;
      let wy: number;
      const landAt = b.delay * landWindow;
      if (this.phaseClock < landAt) {
        // 落下中(上から降ってくる)
        const u = Math.max(0, 1 - (landAt - this.phaseClock) / 0.6);
        if (u <= 0) continue;
        wx = CUP.x + b.landX;
        wy = CUP.y + b.landY - (1 - u) * 500;
      } else if (i !== winner) {
        wx = CUP.x + b.landX;
        wy = CUP.y + b.landY;
      } else {
        // 当選者のボール: 着地点からカップへ寄っていき、縁で粘って沈む
        const rollStart = landWindow;
        const rollEnd = teeterStart;
        const u = Math.min(1, Math.max(0, (this.phaseClock - rollStart) / (rollEnd - rollStart)));
        const e = 1 - Math.pow(1 - u, 2.2);
        const rimX = CUP.x + 9;
        const rimY = CUP.y + 2;
        wx = CUP.x + b.landX + (rimX - CUP.x - b.landX) * e;
        wy = CUP.y + b.landY + (rimY - CUP.y - b.landY) * e;
        if (this.phaseClock >= teeterStart) {
          // カップの縁でぐるっと粘る
          const tt = Math.min(1, (this.phaseClock - teeterStart) / TEETER_SEC);
          const ang = tt * Math.PI * 2.2;
          const rr = 10 * (1 - tt * 0.85);
          wx = CUP.x + Math.cos(ang) * rr;
          wy = CUP.y + Math.sin(ang) * rr * 0.5;
          if (tt >= 0.97) {
            wx = CUP.x;
            wy = CUP.y; // カップイン
          }
        }
      }
      const [sx, sy] = w2s(wx, wy);
      if (sx < -60 || sx > VW + 60 || sy < -60 || sy > VH + 60) continue;
      const sunk = i === winner && this.phaseClock >= this.greenSec - 0.05;
      const r = (n > 40 ? 4.5 : 6) * z * (sunk ? 0.55 : 1);
      g.fillStyle = sunk ? '#cccccc' : '#f5f5f5';
      g.beginPath();
      g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fill();
      // ズームで近づくほど名前が読めるようになる
      const fontSize = 5.5 * z;
      if (fontSize >= 9) {
        g.font = `bold ${fontSize}px sans-serif`;
        g.fillStyle = 'rgba(0,0,0,0.65)';
        g.fillText(this.c.names[i], sx, sy + r + fontSize);
      }
    }
    g.textAlign = 'start';
  }

  private drawReveal(g: CanvasRenderingContext2D): void {
    const name = this.c.names[this.c.script.winnerIndex];
    // カップの中の超アップ
    g.fillStyle = '#14260f';
    g.fillRect(0, 0, VW, VH);
    const pop = Math.min(1, this.phaseClock / 0.35);
    const r = 200 * (0.6 + 0.4 * pop);
    const cx = VW / 2;
    const cy = VH / 2 - 20;
    // ボール
    const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#c8c8c8');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    // ディンプル
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = r * (0.45 + 0.35 * ((i * 7) % 3) * 0.3);
      g.beginPath();
      g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r * 0.05, 0, Math.PI * 2);
      g.fill();
    }
    // ボールに書かれた名前
    g.fillStyle = '#1a1d29';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fontSize = r * 0.42;
    g.font = `bold ${fontSize}px sans-serif`;
    while (g.measureText(name).width > r * 1.5 && fontSize > 18) {
      fontSize *= 0.9;
      g.font = `bold ${fontSize}px sans-serif`;
    }
    g.fillText(name, cx, cy);
    g.textAlign = 'start';
    g.textBaseline = 'alphabetic';
  }
}

export const golfTheme: ThemeModule = {
  id: 'golf',
  name: 'ゴルフ',
  icon: '⛳',
  maxLanes: 100,
  available: true,
  run(ctx: RaceContext): RaceController {
    const shot = new GolfShot(ctx);
    shot.start();
    return { finished: shot.finished, skip: () => shot.skip(), stop: () => shot.stop() };
  },
};
