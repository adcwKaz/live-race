// ゴルフテーマと100名ケースの確認スクリプト
import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/live-race/');
await page.waitForSelector('#roster-input');

// --- ゴルフ(8名・15秒) ---
await page.fill('#roster-input', '田中\n佐藤\n鈴木\n高橋\n伊藤\n渡辺\n山本\n中村');
await page.check('input[name="duration"][value="15"]');
await page.click('.theme-card:nth-child(5)'); // ゴルフ
await page.click('#btn-start');
await page.waitForTimeout(4500); // ティーショット〜フライト
await page.screenshot({ path: '/tmp/golf-flight.png' });
await page.waitForTimeout(5500); // グリーン・ズーム中盤
await page.screenshot({ path: '/tmp/golf-zoom.png' });
await page.waitForTimeout(3500); // リビール直前〜リビール
await page.screenshot({ path: '/tmp/golf-reveal.png' });
await page.waitForSelector('#result-overlay:not(.hidden)', { timeout: 30000 });
console.log('golf WINNER:', await page.textContent('#winner-name'));
await page.click('#btn-back-setup');
await page.waitForTimeout(400);

// --- 競馬100名 ---
const names100 = Array.from({ length: 100 }, (_, i) => `参加者${String(i + 1).padStart(3, '0')}`).join('\n');
await page.fill('#roster-input', names100);
const count = await page.textContent('#roster-count');
const startDisabled = await page.isDisabled('#btn-start');
console.log('100名 count:', count, 'startDisabled:', startDisabled);
await page.click('.theme-card:nth-child(1)'); // 競馬
await page.click('#btn-start');
await page.waitForTimeout(2200);
await page.screenshot({ path: '/tmp/crowd100-intro.png' });
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/crowd100-race.png' });
await page.waitForSelector('#result-overlay:not(.hidden)', { timeout: 40000 });
console.log('keiba100 WINNER:', await page.textContent('#winner-name'));
await page.click('#btn-back-setup');
await page.waitForTimeout(400);

// --- ルーレット100名(スキップで結果まで) ---
await page.click('.theme-card:nth-child(6)');
await page.click('#btn-start');
await page.waitForTimeout(5000);
await page.screenshot({ path: '/tmp/crowd100-roulette.png' });
await page.click('#btn-skip');
await page.waitForSelector('#result-overlay:not(.hidden)', { timeout: 10000 });
console.log('roulette100 WINNER:', await page.textContent('#winner-name'));

console.log('CONSOLE_ERRORS:', errors.length ? errors : 'none');
await browser.close();
