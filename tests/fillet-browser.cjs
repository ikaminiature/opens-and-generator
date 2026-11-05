const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../mesh'),F=require('../fillet');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8000');await page.waitForSelector('#preview[data-ready="true"]');
 for(const name of ['直方体','中空の箱','収納トレー・格子']){
  await page.getByRole('button',{name,exact:true}).click();await page.locator('#fillet-vertical').check();assert.equal(await page.locator('#save-stl').isDisabled(),false);assert.match(await page.locator('#code').inputValue(),/polyhedron/);
  const state=await page.evaluate(()=>window.scadPreviewState);const v=Object.fromEntries(Object.entries(state.raw).map(([k,v])=>[k,k==='fillet'||k==='edit'?v:Number(v)]));
  const downloading=page.waitForEvent('download');await page.locator('#save-stl').click();const d=await downloading;assert.deepEqual(fs.readFileSync(await d.path()),Buffer.from(M.toSTL(M.createMesh(state.type,v))));
  await page.locator('#radius-vertical').fill('100');await page.locator('#radius-vertical').blur();assert.equal(await page.locator('#save-stl').isDisabled(),true);assert.match(await page.locator('#errors').textContent(),/大きすぎ/);
  await page.locator('#radius-vertical').fill('2');await page.locator('#radius-vertical').blur();await page.locator('#fillet-top').check();assert.match(await page.locator('#errors').textContent(),/未対応/);await page.locator('#fillet-top').uncheck();
 }
 await page.locator('[data-wall="v:0:0"]').tap();const e=await page.evaluate(()=>organizerUI.get().raw.edit);await page.locator('#fillet-vertical').uncheck();assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit),e);
 await page.locator('#fillet-vertical').check();await page.locator('#layout-store').click();await page.locator('#fillet-vertical').uncheck();await page.locator('#layout-restore').click();assert.equal(await page.locator('#fillet-vertical').isChecked(),true);
 await page.locator('#organizer-kind').selectOption('grid');assert.equal(await page.locator('#save-stl').isDisabled(),true);await page.locator('#fillet-vertical').uncheck();assert.equal(await page.locator('#save-stl').isDisabled(),false);
 for(const width of [390,820]){await page.setViewportSize({width,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('PASS: 3形状フィレットSTL・プレビュー・未対応/過大R・格子制限・編集維持・設定復元・画面幅');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
