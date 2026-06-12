/** 0以上max未満の整数を暗号論的乱数で返す(モジュロバイアス回避) */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error('max must be positive');
  const range = 0x100000000; // 2^32
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

/** 0以上1未満の乱数(演出用) */
export function rand(): number {
  return secureRandomInt(0x100000) / 0x100000;
}

/** 当選者のインデックスを決定する。全員の確率は均等 */
export function pickWinner(count: number): number {
  return secureRandomInt(count);
}
