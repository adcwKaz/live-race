import { parseRoster } from './core/roster';
import { pickWinner } from './core/lottery';
import { generateRaceScript } from './core/raceScript';
import { loadState, saveState } from './core/storage';
import { AudioEngine } from './core/audio';
import type { RaceController, ThemeModule } from './themes/types';
import { keibaTheme } from './themes/keiba';
import { carTheme } from './themes/car';
import { duckTheme } from './themes/duck';
import { marathonTheme } from './themes/marathon';
import { rouletteTheme } from './themes/roulette';

const THEMES: ThemeModule[] = [keibaTheme, carTheme, duckTheme, marathonTheme, rouletteTheme];

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const screens = {
  setup: $('#screen-setup'),
  race: $('#screen-race'),
};
const rosterInput = $<HTMLTextAreaElement>('#roster-input');
const rosterCount = $('#roster-count');
const rosterWarning = $('#roster-warning');
const themeList = $('#theme-list');
const btnStart = $<HTMLButtonElement>('#btn-start');
const telopEl = $('#telop');
const raceCanvas = $<HTMLCanvasElement>('#race-canvas');
const resultOverlay = $('#result-overlay');
const winnerNameEl = $('#winner-name');
const confettiCanvas = $<HTMLCanvasElement>('#confetti-canvas');

const audio = new AudioEngine();
let selectedThemeId = 'keiba';
let currentNames: string[] = [];
let currentWinner = -1;
let controller: RaceController | null = null;
let confettiRaf = 0;

// ---------- セットアップ画面 ----------

function selectedTheme(): ThemeModule {
  return THEMES.find((t) => t.id === selectedThemeId) ?? THEMES[0];
}

function renderThemeCards(): void {
  themeList.innerHTML = '';
  for (const t of THEMES) {
    const card = document.createElement('div');
    card.className =
      'theme-card' + (t.id === selectedThemeId ? ' selected' : '') + (t.available ? '' : ' disabled');
    card.innerHTML = `<span class="theme-icon">${t.icon}</span>${t.name}` +
      (t.available ? '' : '<span class="coming-soon">準備中</span>');
    if (t.available) {
      card.addEventListener('click', () => {
        selectedThemeId = t.id;
        saveState({ themeId: t.id });
        renderThemeCards();
        validate();
      });
    }
    themeList.appendChild(card);
  }
}

function validate(): void {
  const { names, duplicates } = parseRoster(rosterInput.value);
  rosterCount.textContent = `${names.length}名`;
  const max = selectedTheme().maxLanes;
  let warning = '';
  if (duplicates.length > 0) {
    warning = `⚠️ 同じ名前が複数あります: ${duplicates.join('、')}(別人の場合は番号などを付けてください)`;
  }
  if (names.length > max) {
    warning = `⚠️ ${selectedTheme().name}は最大${max}名までです(現在${names.length}名)。組分け機能は今後対応予定です`;
  }
  rosterWarning.textContent = warning;
  rosterWarning.classList.toggle('hidden', warning === '');
  btnStart.disabled = names.length < 2 || names.length > max;
}

function getDuration(): number {
  const checked = document.querySelector<HTMLInputElement>('input[name="duration"]:checked');
  return Number(checked?.value ?? 45);
}

// ---------- レース進行 ----------

function startRace(names: string[]): void {
  audio.unlock();
  currentNames = names;
  currentWinner = pickWinner(names.length);
  const script = generateRaceScript(names, currentWinner, getDuration(), selectedTheme().flavor);

  screens.setup.classList.remove('active');
  screens.race.classList.add('active');
  resultOverlay.classList.add('hidden');

  controller = selectedTheme().run({
    canvas: raceCanvas,
    names,
    script,
    audio,
    onTelop(text) {
      if (text === null) {
        telopEl.classList.add('hidden');
      } else {
        telopEl.textContent = text;
        telopEl.classList.remove('hidden');
      }
    },
  });

  controller.finished.then(() => {
    controller = null;
    showResult(names[currentWinner]);
  });
}

function showResult(winner: string): void {
  winnerNameEl.textContent = winner;
  resultOverlay.classList.remove('hidden');
  audio.goalFanfare();
  startConfetti();
}

function backToSetup(): void {
  stopConfetti();
  controller?.stop();
  controller = null;
  audio.stopAll();
  resultOverlay.classList.add('hidden');
  screens.race.classList.remove('active');
  screens.setup.classList.add('active');
  validate();
}

// ---------- 紙吹雪 ----------

interface Confetto {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vrot: number; color: string;
}

function startConfetti(): void {
  const ctx = confettiCanvas.getContext('2d')!;
  confettiCanvas.width = confettiCanvas.clientWidth;
  confettiCanvas.height = confettiCanvas.clientHeight;
  const colors = ['#ffb300', '#e6332a', '#2255cc', '#2e9e4f', '#f29fc5', '#f5f5f5'];
  const parts: Confetto[] = Array.from({ length: 160 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * confettiCanvas.height,
    vx: (Math.random() - 0.5) * 60,
    vy: 90 + Math.random() * 120,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  let last = performance.now();
  const tick = (ts: number) => {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (const p of parts) {
      p.x += p.vx * dt + Math.sin(ts / 400 + p.rot) * 0.6;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      if (p.y > confettiCanvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * confettiCanvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    confettiRaf = requestAnimationFrame(tick);
  };
  confettiRaf = requestAnimationFrame(tick);
}

function stopConfetti(): void {
  cancelAnimationFrame(confettiRaf);
}

// ---------- イベント配線 ----------

rosterInput.addEventListener('input', () => {
  saveState({ rosterText: rosterInput.value });
  validate();
});

btnStart.addEventListener('click', () => {
  const { names } = parseRoster(rosterInput.value);
  startRace(names);
});

$('#btn-skip').addEventListener('click', () => controller?.skip());

$('#btn-rematch-same').addEventListener('click', () => {
  stopConfetti();
  resultOverlay.classList.add('hidden');
  startRace(currentNames);
});

$('#btn-rematch-exclude').addEventListener('click', () => {
  stopConfetti();
  const rest = currentNames.filter((_, i) => i !== currentWinner);
  rosterInput.value = rest.join('\n');
  saveState({ rosterText: rosterInput.value });
  if (rest.length < 2) {
    backToSetup();
    return;
  }
  resultOverlay.classList.add('hidden');
  startRace(rest);
});

$('#btn-back-setup').addEventListener('click', backToSetup);

// 音量・全画面
const volumeSlider = $<HTMLInputElement>('#volume-slider');
const btnMute = $('#btn-mute');
let muted = false;

volumeSlider.addEventListener('input', () => {
  audio.setVolume(Number(volumeSlider.value) / 100);
  saveState({ volume: Number(volumeSlider.value) });
});

btnMute.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  btnMute.textContent = muted ? '🔇' : '🔊';
  saveState({ muted });
});

$('#btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
});

$('#duration-list').addEventListener('change', () => saveState({ duration: getDuration() }));

// ---------- 初期化(保存状態の復元) ----------

const saved = loadState();
rosterInput.value = saved.rosterText;
selectedThemeId = THEMES.find((t) => t.id === saved.themeId && t.available)?.id ?? 'keiba';
volumeSlider.value = String(saved.volume);
audio.setVolume(saved.volume / 100);
muted = saved.muted;
audio.setMuted(muted);
btnMute.textContent = muted ? '🔇' : '🔊';
const durRadio = document.querySelector<HTMLInputElement>(`input[name="duration"][value="${saved.duration}"]`);
if (durRadio) durRadio.checked = true;

renderThemeCards();
validate();
