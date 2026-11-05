const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8000');
  await page.waitForSelector('#preview[data-ready="true"]');
  await page.locator('#diameter').fill('42.5');
  assert.match(await page.locator('#code').inputValue(), /d = 42.5/);
  await page.locator('#copy').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#code').inputValue());
  await page.getByRole('button', { name: '円盤', exact: true }).click();
  await page.locator('#hole').fill('40');
  assert.equal(await page.locator('#errors').isVisible(), true);
  assert.equal(await page.locator('#save').isDisabled(), true);
  await page.locator('#hole').fill('10');
  assert.match(await page.locator('#code').inputValue(), /difference/);
  await page.getByRole('button', { name: '直方体', exact: true }).click();
  assert.match(await page.locator('#code').inputValue(), /cube\(\[40, 30, 20\]\)/);
  await page.getByRole('button', { name: '中空の箱', exact: true }).click();
  const code = await page.locator('#code').inputValue();
  const downloading = page.waitForEvent('download'); await page.locator('#save').click();
  const download = await downloading;
  assert.equal(download.suggestedFilename(), 'box.scad');
  const fs = require('node:fs'); assert.equal(fs.readFileSync(await download.path(), 'utf8'), code);
  await page.getByRole('button', { name: '円柱', exact: true }).click();
  assert.equal(await page.locator('#diameter').inputValue(), '42.5');
  await page.locator('#diameter').fill(''); assert.equal(await page.locator('#copy').isDisabled(), true);
  await page.locator('#diameter').fill('30');
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 1180 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(errors, []);
  await browser.close(); console.log('PASS: 形状切替・自動更新・入力検証・コピー・保存内容・入力保持・タッチ画面幅');
})().catch(e => { console.error(e); process.exitCode = 1; });
