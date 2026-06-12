import type { RaceContext, RaceController, ThemeModule } from './types';
import { SideRace, buildCrowdStrip, renderPattern, makeController, VW } from './sideRace';
import { SILKS_COLORS } from './palette';

/** j=シャツ(識別色) s=肌 d=髪/パンツ w=シューズ */
const RUNNER_FRAME_A = [
  '....dd........',
  '...ssss.......',
  '...ssss.......',
  '....jj........',
  '..jjjjjjs.....',
  '.sjjjjjj......',
  '...jjjj.......',
  '...dddd.......',
  '...dd.dd......',
  '..ss...ss.....',
  '..ss....ss....',
  '.ww......ww...',
];

const RUNNER_FRAME_B = [
  '....dd........',
  '...ssss.......',
  '...ssss.......',
  '....jj........',
  '...jjjjs......',
  '..sjjjj.......',
  '...jjjj.......',
  '...dddd.......',
  '....dddd......',
  '....ss.ss.....',
  '...ss..ss.....',
  '...ww..ww.....',
];

class MarathonRace extends SideRace {
  private crowdStrip = buildCrowdStrip('#62626f');
  private skyline: HTMLCanvasElement;

  constructor(c: RaceContext) {
    super(c, {
      introTitle: 'エントリーリスト',
      bgmId: 'marathon',
      ambient: 'steps',
      surfaceColor: '#6e6e76',
      laneLineColor: 'rgba(255,255,255,0.25)',
      railColor: '#2a6fb8',
      photoText: '着順判定中・・・',
    });
    this.skyline = this.buildSkyline();
  }

  private buildSkyline(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 70;
    const g = c.getContext('2d')!;
    for (let x = 0; x < 640; ) {
      const w = 30 + ((x * 13) % 40);
      const h = 24 + ((x * 7) % 44);
      g.fillStyle = (x / 30) % 2 === 0 ? '#5a6478' : '#49536a';
      g.fillRect(x, 70 - h, w - 4, h);
      // 窓
      g.fillStyle = '#c8d4e8';
      for (let wy = 70 - h + 4; wy < 64; wy += 8) {
        for (let wx = x + 3; wx < x + w - 8; wx += 8) {
          if ((wx + wy) % 3 !== 0) g.fillRect(wx, wy, 3, 4);
        }
      }
      x += w;
    }
    return c;
  }

  protected buildSprites(index: number): [HTMLCanvasElement, HTMLCanvasElement] {
    const skins = ['#e8b88a', '#d9a06b', '#c98a55'];
    const palette: Record<string, string> = {
      j: SILKS_COLORS[index % SILKS_COLORS.length],
      s: skins[index % skins.length],
      d: '#333344',
      w: '#f5f0e8',
    };
    return [renderPattern(RUNNER_FRAME_A, palette), renderPattern(RUNNER_FRAME_B, palette)];
  }

  protected drawScenery(g: CanvasRenderingContext2D, camX: number): void {
    const sky = g.createLinearGradient(0, 0, 0, 180);
    sky.addColorStop(0, '#ffb36b');
    sky.addColorStop(1, '#ffe3c2');
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, 180);

    // ビル群(遠景・ゆっくり視差)と沿道の観客
    const shiftFar = (camX * 0.15) % 640;
    for (let x = -shiftFar - 640; x < VW + 640; x += 640) {
      g.drawImage(this.skyline, x, 64, 640, 70);
    }
    const shift = (camX * 0.3) % 640;
    for (let x = -shift - 640; x < VW + 640; x += 640) {
      g.drawImage(this.crowdStrip, x, 134, 640, 32);
    }
    g.fillStyle = '#55555f';
    g.fillRect(0, 166, VW, 8);
  }
}

export const marathonTheme: ThemeModule = {
  id: 'marathon',
  name: 'マラソン',
  icon: '🏃',
  maxLanes: 10,
  available: true,
  flavor: {
    start: '号砲! スタート!!',
    lead: (name) => `${name} が飛び出した!`,
    hold: (name) => `${name} ハイペースで引っ張る!`,
    pass: (name) => `${name} がスパートをかけた!`,
    corner: '競技場が見えてきた! ラスト1km!',
    closing: 'ゴールテープ目前、デッドヒート!!',
  },
  run: (ctx: RaceContext): RaceController => makeController(new MarathonRace(ctx)),
};
