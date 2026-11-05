const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createMesh, toSTL, filename } = require('../mesh');
const { shapes } = require('../generator');
(async () => {
  const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--no-sandbox','--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport:{width:820,height:1180},hasTouch:true,acceptDownloads:true });
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8000');
    await page.waitForSelector('#preview[data-ready="true"]');
    for(const [type,s] of Object.entries(shapes)) {
      await page.getByRole('button',{name:s.name,exact:true}).click();
      await page.locator('#segments').selectOption('48');
      assert.match(await page.locator('#code').inputValue(),/\$fn = 48;/);
      const v=Object.fromEntries(s.fields.map(([key,,value])=>[key,value]));
      const downloadEvent=page.waitForEvent('download');await page.locator('#save-stl').click();const download=await downloadEvent;
      assert.equal(download.suggestedFilename(),filename(type,v,48));
      assert.deepEqual(fs.readFileSync(await download.path()),Buffer.from(toSTL(createMesh(type,v,48))));
    }
    await page.locator('#wall').fill('100');assert.equal(await page.locator('#save-stl').isDisabled(),true);
    assert.deepEqual(errors,[]);
    const fallback=await browser.newContext();
    await fallback.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
    const p=await fallback.newPage();await p.goto(process.env.APP_URL || 'http://127.0.0.1:8000');
    await p.waitForFunction(()=>document.querySelector('#preview-status').textContent.includes('3D表示を開始できません'));
    const downloading=p.waitForEvent('download');await p.locator('#save-stl').click();
    assert.match((await downloading).suggestedFilename(),/^cylinder_diameter-30_height-20_mm_fn-96.stl$/);
    console.log('PASS: 4形状STLの保存内容・寸法入りファイル名・分割数連動・入力エラー・WebGL不可でもSTL保存');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
