import type { RaceContext, RaceController, ThemeModule } from './types';
import { SideRace, renderPattern, makeController, VW } from './sideRace';
import { SILKS_COLORS } from './palette';

/** y=アヒル o=くちばし e=目 c=浮き輪(識別色) w=水しぶき */
const DUCK_FRAME_A = [
  '....................',
  '............yy......',
  '...........yyyy....',
  '...........yeyyoo..',
  '............yy......',
  '.........yyyyyy.....',
  '......yyyyyyyyyy....',
  '.....yyyyyyyyyyy....',
  '....yyyyyyyyyyyy....',
  '...cccccccccccccc...',
  '..cccccccccccccccc..',
  '...cccccccccccccc...',
  '....................',
];

const DUCK_FRAME_B = [
  '............yy......',
  '...........yyyy....',
  '...........yeyyoo..',
  '............yy......',
  '.........yyyyyy.....',
  '......yyyyyyyyyy....',
  '.....yyyyyyyyyyy....',
  '....yyyyyyyyyyyy....',
  '...cccccccccccccc...',
  '..cccccccccccccccc..',
  '...cccccccccccccc...',
  '.w..............w...',
  'w.w....w...w....w.w.',
];

class DuckRace extends SideRace {
  private treeStrip: HTMLCanvasElement;

  constructor(c: RaceContext) {
    super(c, {
      introTitle: 'エントリー',
      bgmId: 'duck',
      ambient: 'water',
      surfaceColor: '#2d7dd2',
      laneLineColor: 'rgba(255,255,255,0.35)',
      railColor: '#f2e9c8',
      photoText: 'ビデオ判定中・・・ガーガー',
    });
    this.treeStrip = this.buildTrees();
  }

  private buildTrees(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 50;
    const g = c.getContext('2d')!;
    for (let x = 0; x < 640; x += 36) {
      const h = 24 + ((x * 7) % 20);
      g.fillStyle = (x / 36) % 2 === 0 ? '#2e7d32' : '#388e3c';
      g.beginPath();
      g.arc(x + 18, 50 - h / 2, h / 2 + 8, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  protected buildSprites(index: number): [HTMLCanvasElement, HTMLCanvasElement] {
    const palette: Record<string, string> = {
      y: '#f7d94c',
      o: '#f07f1e',
      e: '#222222',
      c: SILKS_COLORS[index % SILKS_COLORS.length],
      w: '#dff3ff',
    };
    return [renderPattern(DUCK_FRAME_A, palette), renderPattern(DUCK_FRAME_B, palette)];
  }

  protected drawScenery(g: CanvasRenderingContext2D, camX: number): void {
    const sky = g.createLinearGradient(0, 0, 0, 180);
    sky.addColorStop(0, '#8fd3f0');
    sky.addColorStop(1, '#d9f0fa');
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, 180);

    // 岸辺の木々(視差スクロール)
    const shift = (camX * 0.25) % 640;
    for (let x = -shift - 640; x < VW + 640; x += 640) {
      g.drawImage(this.treeStrip, x, 118, 640, 50);
    }
    // 岸
    g.fillStyle = '#c9b178';
    g.fillRect(0, 166, VW, 8);
  }
}

export const duckTheme: ThemeModule = {
  id: 'duck',
  name: 'アヒルボート',
  icon: '🦆',
  maxLanes: 100,
  available: true,
  flavor: {
    start: 'ガーガー、スタート!!',
    lead: (name) => `${name} 号がすいすい先頭!`,
    hold: (name) => `${name} 号、余裕の表情だ!`,
    pass: (name) => `${name} 号が波に乗ってかわした!`,
    corner: 'ゴールの桟橋が見えてきた!',
    closing: '最後の水しぶき勝負だーー!!',
  },
  run: (ctx: RaceContext): RaceController => makeController(new DuckRace(ctx)),
};
