const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),O=require('../organizer'),M=require('../mesh');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');await page.waitForSelector('#preview[data-ready="true"]');await page.getByRole('button',{name:'収納トレー・格子',exact:true}).click();
 assert.equal(await page.locator('#printWidth').inputValue(),'180');assert.match(await page.locator('#organizer-summary').textContent(),/98 × 66 × 27 mm/);
 const v=Object.fromEntries(O.fields.map(([k,,v])=>[k,v]));
 for(const kind of ['tray','grid']){
  await page.locator('#organizer-kind').selectOption(kind);
  assert.equal(await page.locator('#base').isVisible(),kind==='tray');
  for(const format of ['scad','stl']){
   const downloading=page.waitForEvent('download');await page.locator(format==='scad'?'#save':'#save-stl').click();const d=await downloading;
   const actual=fs.readFileSync(await d.path());
   assert.deepEqual(actual,format==='scad'?Buffer.from(O.generate(v,kind).code):Buffer.from(M.toSTL(M.createMesh(kind,O.generate(v,kind).values))));
   assert.match(d.suggestedFilename(),new RegExp(`^${kind}.*\\.${format}$`));
  }
 }
 await page.locator('#organizer-kind').selectOption('tray');await page.locator('#caseWidth').fill('100');await page.locator('#caseDepth').fill('70');await page.locator('#caseHeight').fill('30');
 assert.match(await page.locator('#organizer-summary').textContent(),/収まります/);assert.match(await page.locator('#organizer-summary').textContent(),/左右各側の余白：1 mm/);
 await page.locator('#caseWidth').fill('97');assert.match(await page.locator('#warnings').textContent(),/ケース内寸/);
 await page.locator('#columns').fill('20');await page.locator('#rows').fill('20');assert.match(await page.locator('#warnings').textContent(),/造形範囲/);assert.match(await page.locator('#organizer-summary').textContent(),/400マス/);
 await page.locator('#columns').fill('0');assert.equal(await page.locator('#save-stl').isDisabled(),true);await page.locator('#columns').fill('2');
 for(const view of ['正面','上面','側面','全体'])await page.getByRole('button',{name:view,exact:true}).click();
 for(const width of [390,820]){await page.setViewportSize({width,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.getByRole('button',{name:'嵌合パーツ',exact:true}).click();assert.equal(await page.locator('#fitting-downloads').isVisible(),true);assert.equal(await page.locator('#organizer-summary').isVisible(),false);
 await page.getByRole('button',{name:'円柱',exact:true}).click();assert.equal(await page.locator('#segments').isVisible(),true);assert.equal(await page.locator('#save-stl').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS: トレー/格子切替・STL/SCAD保存内容・ケース余白と警告・20×20更新・入力エラー・画面幅・既存モード');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
