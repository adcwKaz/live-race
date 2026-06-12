/**
 * AI実況ボイス。
 * ブラウザ内蔵のWeb Speech API(speechSynthesis)を使うため
 * 無料・外部送信なしで動くが、声の質はOS/ブラウザに依存する。
 */
export class Narrator {
  private enabled = false;
  private volume = 0.7;
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;

  constructor() {
    if (!this.supported) return;
    // 音声リストは非同期で届くことがある
    speechSynthesis.addEventListener?.('voiceschanged', () => this.pickVoice());
    this.pickVoice();
  }

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stop();
  }

  /** 自然に聞こえやすい日本語ボイスを優先順で選ぶ */
  private pickVoice(): void {
    if (!this.supported) return;
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;
    this.voicesLoaded = true;
    const ja = voices.filter((v) => v.lang.startsWith('ja'));
    const prefer = ['Nanami', 'Google 日本語', 'Kyoko', 'O-Ren', 'Hattori'];
    for (const name of prefer) {
      const hit = ja.find((v) => v.name.includes(name));
      if (hit) {
        this.voice = hit;
        return;
      }
    }
    this.voice = ja[0] ?? null;
  }

  /**
   * 実況をしゃべる。直前の発話が残っていたら破棄して最新を優先する
   * (レース展開に声が遅れてかぶさり続けるのを防ぐ)
   */
  speak(text: string, opts: { excited?: boolean } = {}): void {
    if (!this.enabled || !this.supported || this.muted) return;
    if (!this.voicesLoaded) this.pickVoice();
    speechSynthesis.cancel();
    // 記号は読み上げノイズになるので落とす
    const clean = text.replace(/[!!]+/g, '!').replace(/[・]{2,}/g, '、');
    const u = new SpeechSynthesisUtterance(clean);
    if (this.voice) u.voice = this.voice;
    u.lang = 'ja-JP';
    u.rate = opts.excited ? 1.05 : 1.2;
    u.pitch = opts.excited ? 1.15 : 1.05;
    u.volume = this.volume;
    speechSynthesis.speak(u);
  }

  stop(): void {
    if (this.supported) speechSynthesis.cancel();
  }
}
