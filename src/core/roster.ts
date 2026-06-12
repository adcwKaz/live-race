export interface RosterResult {
  names: string[];
  duplicates: string[];
}

/** テキストエリアの内容を名簿に整形する(空行除去・トリム・重複検出) */
export function parseRoster(text: string): RosterResult {
  const names = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }

  return { names, duplicates: [...duplicates] };
}
