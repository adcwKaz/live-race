const KEY = 'live-race:state:v1';

export interface SavedState {
  rosterText: string;
  themeId: string;
  duration: number;
  volume: number;
  muted: boolean;
  narration: boolean;
}

const DEFAULTS: SavedState = {
  rosterText: '',
  themeId: 'keiba',
  duration: 45,
  volume: 70,
  muted: false,
  narration: false,
};

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(patch: Partial<SavedState>): void {
  const next = { ...loadState(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ストレージ不可(プライベートモード等)でも動作は継続する
  }
}
