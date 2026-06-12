import type { RaceScript, EventFlavor } from '../core/raceScript';
import type { AudioEngine } from '../core/audio';

export interface RaceContext {
  canvas: HTMLCanvasElement;
  names: string[];
  script: RaceScript;
  audio: AudioEngine;
  /** 実況テロップの表示(nullで非表示) */
  onTelop(text: string | null): void;
}

export interface RaceController {
  /** レース演出が完了(結果発表可能)になったら解決する */
  finished: Promise<void>;
  /** 演出を飛ばして即終了する */
  skip(): void;
  /** 画面遷移などによる中断 */
  stop(): void;
}

export interface ThemeModule {
  id: string;
  name: string;
  icon: string;
  /** 1レースに同時表示できる最大人数 */
  maxLanes: number;
  available: boolean;
  /** 実況テロップの語彙(省略時は競馬風) */
  flavor?: EventFlavor;
  run(ctx: RaceContext): RaceController;
}
