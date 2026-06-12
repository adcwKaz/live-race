import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/live-race/');
await page.waitForSelector('#roster-input');
await page.fill('#roster-input', '田中\n佐藤\n鈴木\n高橋\n伊藤\n渡辺\n山本\n中村');
await page.check('input[name="duration"][value="30"]');
await page.screenshot({ path: '/tmp/shot-1-setup.png' });

await page.click('#btn-start');
await page.waitForTimeout(2000); // 出走表(イントロ)
await page.screenshot({ path: '/tmp/shot-2-intro.png' });
await page.waitForTimeout(6000); // レース序盤
await page.screenshot({ path: '/tmp/shot-3-race-early.png' });
await page.waitForTimeout(18000); // レース終盤
await page.screenshot({ path: '/tmp/shot-4-race-late.png' });

await page.waitForSelector('#result-overlay:not(.hidden)', { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shot-5-result.png' });
const winner = await page.textContent('#winner-name');
console.log('WINNER:', winner);

// 再レース(当選者除外)も一回り確認
await page.click('#btn-rematch-exclude');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shot-6-rematch.png' });
await page.click('#btn-skip');
await page.waitForSelector('#result-overlay:not(.hidden)', { timeout: 10000 });
const winner2 = await page.textContent('#winner-name');
console.log('WINNER2:', winner2);

console.log('CONSOLE_ERRORS:', errors.length ? errors : 'none');
await browser.close();
