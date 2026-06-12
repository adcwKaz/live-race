// 全テーマを15秒設定で通し実行し、中盤と結果のスクリーンショットを撮る確認スクリプト
import { chromium } from 'playwright';

const THEMES = ['keiba', 'car', 'duck', 'marathon', 'roulette'];
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/live-race/');
await page.waitForSelector('#roster-input');
await page.fill('#roster-input', '田中\n佐藤\n鈴木\n高橋\n伊藤\n渡辺\n山本\n中村');
await page.check('input[name="duration"][value="15"]');

for (let i = 0; i < THEMES.length; i++) {
  const id = THEMES[i];
  await page.click(`.theme-card:nth-child(${i + 1})`);
  await page.click('#btn-start');
  await page.waitForTimeout(5500); // イントロ後のレース序盤〜中盤
  await page.screenshot({ path: `/tmp/theme-${id}-mid.png` });
  await page.waitForSelector('#result-overlay:not(.hidden)', { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/theme-${id}-result.png` });
  const winner = await page.textContent('#winner-name');
  console.log(`${id}: WINNER=${winner}`);
  await page.click('#btn-back-setup');
  await page.waitForTimeout(400);
}

console.log('CONSOLE_ERRORS:', errors.length ? errors : 'none');
await browser.close();
