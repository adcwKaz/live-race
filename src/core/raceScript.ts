import { rand } from './lottery';

export interface RacerScript {
  /** このレーサーがゴールする時刻(秒) */
  finishTime: number;
  /** 時刻t(秒)でのコース進捗 0..1(1=ゴール) */
  progressAt(t: number): number;
}

export interface RaceEvent {
  time: number;
  text: string;
  /** 効果音のキュー */
  sfx?: 'start' | 'crowd' | 'bell';
}

export interface RaceScript {
  winnerIndex: number;
  /** 勝者がゴールする時刻(秒) */
  duration: number;
  photoFinish: boolean;
  racers: RacerScript[];
  events: RaceEvent[];
}

/** テーマごとの実況の語彙 */
export interface EventFlavor {
  start: string;
  lead(name: string): string;
  hold(name: string): string;
  pass(name: string): string;
  corner: string;
  closing: string;
}

const DEFAULT_FLAVOR: EventFlavor = {
  start: 'スタート!!',
  lead: (name) => `${name} が先頭に立った!`,
  hold: (name) => `${name} 逃げる逃げる!`,
  pass: (name) => `${name} がかわして先頭!`,
  corner: '最終コーナーを回った!',
  closing: 'ゴール前、大接戦だーーっ!!',
};

/**
 * レース台本を生成する。
 * 当選者(winnerIndex)が必ず1着になるよう各レーサーのゴール時刻を先に決め、
 * 道中の順位変動は結果に影響しない揺らぎとして合成する。
 */
export function generateRaceScript(
  names: string[],
  winnerIndex: number,
  duration: number,
  flavor: EventFlavor = DEFAULT_FLAVOR,
): RaceScript {
  const n = names.length;

  // ゴール時刻: 勝者=duration、2着は僅差(写真判定の可能性あり)、以降は徐々に離す
  const finishTimes = new Array<number>(n);
  const losers = names.map((_, i) => i).filter((i) => i !== winnerIndex);
  // 道中をシャッフルして着順をランダム化
  for (let i = losers.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [losers[i], losers[j]] = [losers[j], losers[i]];
  }
  finishTimes[winnerIndex] = duration;
  losers.forEach((racerIdx, rank) => {
    if (rank === 0) {
      // 2着: 0.06〜0.45秒差。0.18秒未満なら写真判定になる
      finishTimes[racerIdx] = duration + 0.06 + rand() * 0.39;
    } else if (rank === 1) {
      finishTimes[racerIdx] = duration + 0.5 + rand() * 0.5;
    } else {
      // 3着以降は最大でも勝者の +10% に収める(画面外に取り残されないように)
      const spread = (rank - 1) / Math.max(1, losers.length - 2);
      finishTimes[racerIdx] = duration + 1.0 + spread * duration * 0.09 + rand() * 0.4;
    }
  });

  const photoFinish = Math.min(...losers.map((i) => finishTimes[i])) - duration < 0.18;

  // 道中の揺らぎ: 中盤で大きく、スタートとゴールでゼロになる時間シフト。
  // 振幅×角速度 < 1 を保つことで進捗の単調増加(後退しない)を保証する
  const racers: RacerScript[] = names.map((_, i) => {
    const T = finishTimes[i];
    const cycles = 1.5 + rand() * 1.0; // レース中の波の回数
    const omega = (Math.PI * 2 * cycles) / T;
    const amp = (0.55 / omega) * (0.5 + rand() * 0.5);
    const phase = rand() * Math.PI * 2;
    const progressAt = (t: number): number => {
      const x = Math.min(1, Math.max(0, t / T));
      const env = 4 * x * (1 - x); // 両端0・中央1
      const shifted = t + amp * Math.sin(omega * t + phase) * env;
      return Math.min(1, Math.max(0, shifted / T));
    };
    return { finishTime: T, progressAt };
  });

  const leaderAt = (t: number): number => {
    let best = 0;
    for (let i = 1; i < n; i++) {
      if (racers[i].progressAt(t) > racers[best].progressAt(t)) best = i;
    }
    return best;
  };

  // 実況テロップ: 実際の描画位置と一致するよう、台本から先頭をサンプリングして生成
  const events: RaceEvent[] = [{ time: 0, text: flavor.start, sfx: 'start' }];
  const mid1 = leaderAt(duration * 0.3);
  events.push({ time: duration * 0.3, text: flavor.lead(names[mid1]) });
  const mid2 = leaderAt(duration * 0.55);
  events.push({
    time: duration * 0.55,
    text: mid2 === mid1 ? flavor.hold(names[mid2]) : flavor.pass(names[mid2]),
  });
  events.push({ time: duration * 0.75, text: flavor.corner, sfx: 'bell' });
  events.push({ time: duration * 0.88, text: flavor.closing, sfx: 'crowd' });

  return { winnerIndex, duration, photoFinish, racers, events };
}
