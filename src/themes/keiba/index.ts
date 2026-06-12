import type { RaceContext, RaceController, ThemeModule } from '../types';
import { buildHorseSprites, SILKS_COLORS, SPRITE_W, SPRITE_H } from './sprites';

// 仮想解像度(16:9)。実キャンバスへはレターボックスでフィットさせる
const VW = 1280;
const VH = 720;
// スタートからゴールまでのワールド座標長
const TRACK_LEN = 6000;

const INTRO_SEC = 3.4;
const SLOWMO_WINDOW = 1.1; // ゴール前この秒数だけスローモーション
const SLOWMO_SCALE = 0.42;

type Phase = 'intro' | 'race' | 'photo' | 'announce' | 'done';

class KeibaRace {
  private ctx2d: CanvasRenderingContext2D;
  private sprites: Array<[HTMLCanvasElement, HTMLCanvasElement]>;
  private crowdStrip: HTMLCanvasElement;
  private raf = 0;
  private lastTs = 0;
  private phase: Phase = 'intro';
  private phaseClock = 0;
  private raceClock = 0;
  private firedEvents = new Set<number>();
  private telopTimer: number | null = null;
  private resolveFinished!: () => void;
  finished: Promise<void>;

  constructor(private c: RaceContext) {
    this.ctx2d = c.canvas.getContext('2d')!;
    this.sprites = c.names.map((_, i) => buildHorseSprites(i));
    this.crowdStrip = this.buildCrowd();
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

  // ---------- 進行 ----------

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseClock = 0;
    const { audio, script, names } = this.c;
    if (p === 'race') {
      audio.startBgm('keiba');
      audio.gallopStart();
    }
    if (p === 'photo') {
      audio.gallopStop();
      audio.stopBgm();
      this.telop('写真判定中・・・');
      audio.drumroll(2.6);
    }
    if (p === 'announce') {
      audio.gallopStop();
      audio.stopBgm();
      this.telop(`1着 ${names[script.winnerIndex]}!!`);
    }
    if (p === 'done') {
      this.stop();
      this.c.onTelop(null);
      this.resolveFinished();
    }
  }

  private telop(text: string, hideAfter = 2.4): void {
    this.c.onTelop(text);
    if (this.telopTimer !== null) clearTimeout(this.telopTimer);
    this.telopTimer = window.setTimeout(() => this.c.onTelop(null), hideAfter * 1000);
  }

  private loop = (ts: number): void => {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.update(dt);
    this.draw();
    if (this.phase !== 'done') this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    const { script } = this.c;
    this.phaseClock += dt;

    switch (this.phase) {
      case 'intro':
        if (this.phaseClock >= INTRO_SEC) this.setPhase('race');
        break;

      case 'race': {
        // ゴール直前はスローモーションで接戦を見せる
        const remain = script.duration - this.raceClock;
        const scale = remain > 0 && remain < SLOWMO_WINDOW ? SLOWMO_SCALE : 1;
        this.raceClock += dt * scale;

        for (const ev of script.events) {
          if (this.raceClock >= ev.time && !this.firedEvents.has(ev.time)) {
            this.firedEvents.add(ev.time);
            this.telop(ev.text);
            if (ev.sfx === 'start') this.c.audio.startSignal();
            if (ev.sfx === 'bell') this.c.audio.bell();
            if (ev.sfx === 'crowd') this.c.audio.crowd(4);
          }
        }

        // 勝者+0.8秒まで進めて(2着3着もゴールさせて)から次フェーズへ
        if (this.raceClock >= script.duration + 0.8) {
          this.setPhase(script.photoFinish ? 'photo' : 'announce');
        }
        break;
      }

      case 'photo':
        this.raceClock += dt * 0.3; // 後続はゆっくり流し続ける
        if (this.phaseClock >= 2.8) this.setPhase('announce');
        break;

      case 'announce':
        this.raceClock += dt * 0.3;
        if (this.phaseClock >= 1.6) this.setPhase('done');
        break;
    }
  }

  // ---------- 描画 ----------

  private buildCrowd(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 36;
    const g = c.getContext('2d')!;
    g.fillStyle = '#5a5a6e';
    g.fillRect(0, 0, c.width, c.height);
    const colors = ['#d9c2a0', '#c2657a', '#7ab0d4', '#e0d77a', '#9fd47a', '#b08bd4'];
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      g.fillRect(Math.floor(Math.random() * 320) * 2, Math.floor(Math.random() * 18) * 2, 2, 2);
    }
    return c;
  }

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

    this.drawWorld(g);
    if (this.phase === 'intro') this.drawIntro(g);
    if (this.phase === 'photo') this.drawPhotoFlash(g);
  }

  private progressPx(i: number): number {
    const t = this.phase === 'intro' ? 0 : this.raceClock;
    return this.c.script.racers[i].progressAt(t) * TRACK_LEN;
  }

  private drawWorld(g: CanvasRenderingContext2D): void {
    const n = this.c.names.length;

    // カメラ: 先頭の馬を画面の65%位置に置く
    const leadPx = Math.max(...this.c.names.map((_, i) => this.progressPx(i)));
    const camX = Math.min(Math.max(leadPx - VW * 0.62, -200), TRACK_LEN - VW * 0.8);

    // 空
    const sky = g.createLinearGradient(0, 0, 0, 180);
    sky.addColorStop(0, '#7ec8e8');
    sky.addColorStop(1, '#cfe9f5');
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, 180);

    // 観客スタンド(視差スクロール)
    const crowdShift = (camX * 0.3) % 640;
    for (let x = -crowdShift - 640; x < VW + 640; x += 640) {
      g.drawImage(this.crowdStrip, x, 130, 640, 36);
    }
    g.fillStyle = '#8a8a9e';
    g.fillRect(0, 166, VW, 8);

    // 芝コース
    g.fillStyle = '#3f9c40';
    g.fillRect(0, 174, VW, VH - 174);

    const trackTop = 196;
    const trackBottom = VH - 30;
    const laneH = (trackBottom - trackTop) / n;

    // 白ラチ(上下の柵)
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, trackTop - 14, VW, 5);
    g.fillRect(0, trackBottom + 4, VW, 5);

    // ハロン棒(距離マーカー)とスタート・ゴール
    for (let wx = 0; wx <= TRACK_LEN; wx += 750) {
      const x = wx - camX;
      if (x < -40 || x > VW + 40) continue;
      g.fillStyle = '#e8e0c8';
      g.fillRect(x, trackTop - 36, 6, 26);
    }
    this.drawGate(g, 0 - camX, trackTop);
    this.drawGoal(g, TRACK_LEN - camX, trackTop, trackBottom);

    // 馬(進捗が小さい順に描いて先頭を手前に)
    const order = this.c.names.map((_, i) => i).sort((a, b) => this.progressPx(a) - this.progressPx(b));
    const spriteScale = Math.min(3.4, Math.max(1.4, (laneH * 0.95) / SPRITE_H));
    for (const i of order) {
      const x = this.progressPx(i) - camX;
      const y = trackTop + laneH * i + laneH / 2;
      if (x < -120 || x > VW + 120) continue;
      const frame = Math.floor((this.raceClock * 9 + i * 1.3) % 2);
      const spr = this.sprites[i][this.phase === 'intro' ? 0 : frame];
      const w = SPRITE_W * spriteScale;
      const h = SPRITE_H * spriteScale;
      g.drawImage(spr, x - w / 2, y - h / 2, w, h);
      // 名前ラベル
      g.font = `bold ${Math.max(13, spriteScale * 5.5)}px sans-serif`;
      const label = this.c.names[i];
      const tw = g.measureText(label).width;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x - tw / 2 - 5, y - h / 2 - 18, tw + 10, 17);
      g.fillStyle = SILKS_COLORS[i % SILKS_COLORS.length];
      g.fillRect(x - tw / 2 - 5, y - h / 2 - 18, 4, 17);
      g.fillStyle = '#fff';
      g.textBaseline = 'top';
      g.fillText(label, x - tw / 2 + 2, y - h / 2 - 16);
    }

    this.drawMiniMap(g, leadPx);
    if (this.phase !== 'intro') this.drawRanking(g);
  }

  private drawGate(g: CanvasRenderingContext2D, x: number, top: number): void {
    if (x < -80 || x > VW + 80) return;
    g.fillStyle = '#cccccc';
    g.fillRect(x - 46, top - 40, 8, VH - top - 20);
    g.fillStyle = '#888';
    g.fillRect(x - 52, top - 52, 20, 14);
  }

  private drawGoal(g: CanvasRenderingContext2D, x: number, top: number, bottom: number): void {
    if (x < -80 || x > VW + 80) return;
    // 紅白のゴール柱とチェッカー旗
    g.fillStyle = '#cc2222';
    for (let y = top - 50; y < bottom; y += 16) {
      g.fillRect(x + 20, y, 10, 8);
    }
    g.fillStyle = '#f5f5f5';
    for (let y = top - 42; y < bottom; y += 16) {
      g.fillRect(x + 20, y, 10, 8);
    }
    g.fillStyle = '#222';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        if ((r + c) % 2 === 0) g.fillRect(x - 10 + c * 12, top - 110 + r * 12, 12, 12);
      }
    }
    g.fillStyle = '#fff';
    g.font = 'bold 22px sans-serif';
    g.textBaseline = 'alphabetic';
    g.fillText('GOAL', x - 4, top - 120);
  }

  private drawMiniMap(g: CanvasRenderingContext2D, leadPx: number): void {
    const mx = VW * 0.2;
    const mw = VW * 0.6;
    const my = 28;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(mx - 10, my - 12, mw + 20, 26);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(mx, my);
    g.lineTo(mx + mw, my);
    g.stroke();
    g.fillStyle = '#ffb300';
    g.fillRect(mx + mw - 2, my - 8, 4, 16); // ゴール位置
    this.c.names.forEach((_, i) => {
      g.fillStyle = SILKS_COLORS[i % SILKS_COLORS.length];
      const px = mx + (this.progressPx(i) / TRACK_LEN) * mw;
      g.beginPath();
      g.arc(px, my, 5, 0, Math.PI * 2);
      g.fill();
    });
    void leadPx;
  }

  private drawRanking(g: CanvasRenderingContext2D): void {
    // ゴール済み(進捗1.0)同士はゴール時刻の早い順で順位を確定させる
    const { racers } = this.c.script;
    const order = this.c.names
      .map((_, i) => i)
      .sort(
        (a, b) =>
          this.progressPx(b) - this.progressPx(a) ||
          racers[a].finishTime - racers[b].finishTime,
      )
      .slice(0, 3);
    g.font = 'bold 18px sans-serif';
    g.textBaseline = 'top';
    order.forEach((idx, rank) => {
      const y = 60 + rank * 26;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(14, y, 190, 23);
      g.fillStyle = SILKS_COLORS[idx % SILKS_COLORS.length];
      g.fillRect(14, y, 5, 23);
      g.fillStyle = rank === 0 ? '#ffd54a' : '#fff';
      g.fillText(`${rank + 1}位 ${this.c.names[idx]}`, 26, y + 3);
    });
  }

  private drawIntro(g: CanvasRenderingContext2D): void {
    const n = this.c.names.length;
    g.fillStyle = 'rgba(10,12,24,0.82)';
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#ffb300';
    g.font = 'bold 44px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText('出 走 表', VW / 2, 50);

    const cols = n > 8 ? 2 : 1;
    const rows = Math.ceil(n / cols);
    const rowH = Math.min(48, 500 / rows);
    g.font = `bold ${Math.min(26, rowH * 0.55)}px sans-serif`;
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = cols === 1 ? VW / 2 : VW * (col === 0 ? 0.3 : 0.7);
      const y = 140 + row * rowH;
      g.fillStyle = SILKS_COLORS[i % SILKS_COLORS.length];
      g.fillRect(x - 180, y, rowH * 0.6, rowH * 0.6);
      g.fillStyle = '#fff';
      g.textAlign = 'left';
      g.fillText(`${i + 1}  ${this.c.names[i]}`, x - 180 + rowH * 0.8, y);
    }
    g.textAlign = 'start';
  }

  private drawPhotoFlash(g: CanvasRenderingContext2D): void {
    const a = Math.max(0, 0.85 - this.phaseClock * 1.5);
    if (a > 0) {
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.fillRect(0, 0, VW, VH);
    }
  }
}

export const keibaTheme: ThemeModule = {
  id: 'keiba',
  name: '競馬',
  icon: '🏇',
  maxLanes: 12,
  available: true,
  run(ctx: RaceContext): RaceController {
    const race = new KeibaRace(ctx);
    race.start();
    return {
      finished: race.finished,
      skip: () => race.skip(),
      stop: () => race.stop(),
    };
  },
};
