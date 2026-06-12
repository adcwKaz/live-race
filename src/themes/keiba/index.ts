import type { RaceContext, RaceController, ThemeModule } from '../types';
import { SideRace, buildCrowdStrip, renderPattern, VW } from '../sideRace';
import { SILKS_COLORS } from '../palette';
import { HORSE_FRAME_A, HORSE_FRAME_B } from './sprites';

const BODY_COLORS = ['#8a5a2b', '#6b4423', '#a9743c', '#4a3320', '#96672e', '#7d5634'];

class KeibaRace extends SideRace {
  private crowdStrip = buildCrowdStrip();

  constructor(c: RaceContext) {
    super(c, {
      introTitle: '出 走 表',
      bgmId: 'keiba',
      ambient: 'gallop',
      surfaceColor: '#3f9c40',
      railColor: '#f2f2f2',
    });
  }

  protected buildSprites(index: number): [HTMLCanvasElement, HTMLCanvasElement] {
    const silks = SILKS_COLORS[index % SILKS_COLORS.length];
    const palette: Record<string, string> = {
      b: BODY_COLORS[index % BODY_COLORS.length],
      d: '#332313',
      j: silks,
      h: silks === '#f5f5f5' ? '#cc3333' : silks,
      s: '#e8b88a',
      w: '#f5f0e8',
    };
    return [renderPattern(HORSE_FRAME_A, palette), renderPattern(HORSE_FRAME_B, palette)];
  }

  protected drawScenery(g: CanvasRenderingContext2D, camX: number): void {
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
    return { finished: race.finished, skip: () => race.skip(), stop: () => race.stop() };
  },
};
