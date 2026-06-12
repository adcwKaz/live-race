/**
 * ドット絵スプライト定義。
 * 文字 = 色: b=馬体 d=たてがみ/尾/蹄 j=勝負服 h=ヘルメット s=肌 w=鼻先 .=透明
 */
const FRAME_A = [
  '........................',
  '.........hh.............',
  '........hjjs............',
  '........jjjj......bb....',
  '.dd.....jjjj.....bbbb...',
  '.ddd...bbbbbbbbbbbbbb.w.',
  '..ddbbbbbbbbbbbbbbbb....',
  '...bbbbbbbbbbbbbbbb.....',
  '...bbbbbbbbbbbbbb.......',
  '....bbb.bbbbb..bb.......',
  '...bb.....bb....bb......',
  '..bb.......bb....bb.....',
  '.bb.........bb....bb....',
  '.d...........d.....d....',
  '........................',
  '........................',
];

const FRAME_B = [
  '........................',
  '.........hh.............',
  '........hjjs............',
  '........jjjj......bb....',
  '.d......jjjj.....bbbb...',
  '.dd....bbbbbbbbbbbbbb.w.',
  '..dbbbbbbbbbbbbbbbbb....',
  '...bbbbbbbbbbbbbbbb.....',
  '...bbbbbbbbbbbbbbb......',
  '....bbbb.bbbbb.bb.......',
  '.....bb...bbb...bb......',
  '......bb..bb.....b......',
  '.....bb....bb...........',
  '........................',
  '........................',
  '........................',
];

export const SPRITE_W = 24;
export const SPRITE_H = 16;

/** 枠番カラー(JRA準拠8色+拡張4色) */
export const SILKS_COLORS = [
  '#f5f5f5', // 1 白
  '#222222', // 2 黒
  '#e6332a', // 3 赤
  '#2255cc', // 4 青
  '#f2d022', // 5 黄
  '#2e9e4f', // 6 緑
  '#f07f1e', // 7 橙
  '#f29fc5', // 8 桃
  '#8e44ad', // 9 紫
  '#19b5c4', // 10 水
  '#7a4f21', // 11 茶
  '#9aa0a8', // 12 灰
];

const BODY_COLORS = ['#8a5a2b', '#6b4423', '#a9743c', '#4a3320', '#96672e', '#7d5634'];

/** 1頭ぶんのスプライト(2フレーム)をオフスクリーンに描いて返す */
export function buildHorseSprites(index: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const silks = SILKS_COLORS[index % SILKS_COLORS.length];
  const body = BODY_COLORS[index % BODY_COLORS.length];
  const palette: Record<string, string> = {
    b: body,
    d: '#332313',
    j: silks,
    h: silks === '#f5f5f5' ? '#cc3333' : silks,
    s: '#e8b88a',
    w: '#f5f0e8',
  };

  const render = (pattern: string[]): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    const g = c.getContext('2d')!;
    pattern.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  };

  return [render(FRAME_A), render(FRAME_B)];
}
