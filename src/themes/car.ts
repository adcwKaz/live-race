import type { RaceContext, RaceController, ThemeModule } from './types';
import { SideRace, buildCrowdStrip, renderPattern, makeController, VW } from './sideRace';
import { SILKS_COLORS } from './palette';

/** c=ボディ d=タイヤ g=バイザー w=ライト x=ホイールマーク o=排気炎 */
const CAR_FRAME_A = [
  '..cc....................',
  '..cc.......ggg..........',
  '..ccc.....ggggg.........',
  '...ccccccccggccc........',
  '...cccccccccccccccccc...',
  '..ccccccccccccccccccccw.',
  '..ccccccccccccccccccccw.',
  '...dddd........dddd.....',
  '..dddddd......dddddd....',
  '..ddxddd......ddxddd....',
  '..dddddd......dddddd....',
  '...dddd........dddd.....',
];

const CAR_FRAME_B = [
  '..cc....................',
  '..cc.......ggg..........',
  'o.ccc.....ggggg.........',
  'oocccccccccggccc........',
  'o..cccccccccccccccccc...',
  '..ccccccccccccccccccccw.',
  '..ccccccccccccccccccccw.',
  '...dddd........dddd.....',
  '..dddddd......dddddd....',
  '..dddxdd......dddxdd....',
  '..dddddd......dddddd....',
  '...dddd........dddd.....',
];

class CarRace extends SideRace {
  private crowdStrip = buildCrowdStrip('#4a4a58');

  constructor(c: RaceContext) {
    super(c, {
      introTitle: 'スターティンググリッド',
      bgmId: 'car',
      ambient: 'engine',
      surfaceColor: '#4d4d55',
      laneLineColor: '#e8e8e8',
      railColor: '#dd3333',
      photoText: 'フォトフィニッシュ判定中・・・',
    });
  }

  protected buildSprites(index: number): [HTMLCanvasElement, HTMLCanvasElement] {
    const body = SILKS_COLORS[index % SILKS_COLORS.length];
    const palette: Record<string, string> = {
      c: body,
      d: '#1c1c1c',
      g: '#9fd8f0',
      w: '#f5f0e8',
      x: '#b9b9b9',
      o: '#ff8c1e',
    };
    return [renderPattern(CAR_FRAME_A, palette), renderPattern(CAR_FRAME_B, palette)];
  }

  protected drawScenery(g: CanvasRenderingContext2D, camX: number): void {
    const sky = g.createLinearGradient(0, 0, 0, 180);
    sky.addColorStop(0, '#6fb6dd');
    sky.addColorStop(1, '#cde6f2');
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, 180);

    // スポンサー看板風の帯+観客
    const shift = (camX * 0.3) % 640;
    g.fillStyle = '#2a2f3e';
    g.fillRect(0, 118, VW, 14);
    const adColors = ['#e6332a', '#2255cc', '#f2d022', '#2e9e4f'];
    for (let x = -shift - 640; x < VW + 640; x += 160) {
      g.fillStyle = adColors[Math.abs(Math.round(x / 160)) % adColors.length];
      g.fillRect(x + 20, 120, 90, 10);
    }
    for (let x = -shift - 640; x < VW + 640; x += 640) {
      g.drawImage(this.crowdStrip, x, 132, 640, 34);
    }
    g.fillStyle = '#33333b';
    g.fillRect(0, 166, VW, 8);
  }
}

export const carTheme: ThemeModule = {
  id: 'car',
  name: 'カーレース',
  icon: '🏎️',
  maxLanes: 100,
  available: true,
  flavor: {
    start: 'シグナル グリーン! スタート!!',
    lead: (name) => `${name} がトップに浮上!`,
    hold: (name) => `${name} 独走態勢か!?`,
    pass: (name) => `${name} がオーバーテイク!`,
    corner: 'ファイナルラップ!',
    closing: 'チェッカーフラッグ目前、大接戦!!',
  },
  run: (ctx: RaceContext): RaceController => makeController(new CarRace(ctx)),
};
