const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');await page.waitForFunction(()=>!!globalThis.Chamfer);await page.waitForSelector('#preview[data-ready="true"]');
 for(const name of ['直方体','中空の箱','収納トレー・格子']){
  await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('#radius-top').inputValue(),'0.5');assert.equal(await page.locator('#radius-bottom').inputValue(),'0.3');
  await page.locator('#fillet-vertical').check();await page.locator('#fillet-top').check();await page.locator('#fillet-bottom').check();if(name==='収納トレー・格子'){await page.locator('#fillet-divider').check();await page.locator('[data-wall="v:0:0"]').tap();}
  assert.equal(await page.locator('#save-stl').isDisabled(),false);assert.match(await page.locator('#code').inputValue(),/polyhedron/);
  for(const format of ['stl','scad']){
   const event=page.waitForEvent('download');await page.locator(format==='stl'?'#save-stl':'#save').click();const d=await event,actual=fs.readFileSync(await d.path());
   const expected=await page.evaluate(format=>{const s=window.scadPreviewState,v=Object.fromEntries(Object.entries(s.raw).map(([k,v])=>[k,k==='fillet'||k==='edit'?v:Number(v)]));return format==='stl'?Array.from(new Uint8Array(ScadMesh.toSTL(ScadMesh.createMesh(s.type,v)))):document.querySelector('#code').value;},format);
   assert.deepEqual(actual,format==='stl'?Buffer.from(expected):Buffer.from(expected));
  }
 }
 await page.locator('#radius-divider').fill('2');assert.match(await page.locator('#errors').textContent(),/干渉|仕切り厚/);assert.equal(await page.locator('#save-stl').isDisabled(),true);await page.locator('#radius-divider').fill('0.3');
 await page.locator('#fillet-vertical').uncheck();await page.locator('#fillet-top').uncheck();await page.locator('#fillet-bottom').uncheck();await page.locator('#organizer-kind').selectOption('grid');assert.equal(await page.locator('#save-stl').isDisabled(),false);
 await page.locator('#fillet-top').check();assert.match(await page.locator('#errors').textContent(),/未対応/);await page.locator('#fillet-top').uncheck();assert.equal(await page.locator('#save-stl').isDisabled(),false);
 for(const width of [390,820]){await page.setViewportSize({width,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);
 const offline=await browser.newPage();await offline.route('**/manifold.wasm',route=>route.abort());await offline.goto(process.env.APP_URL||'http://127.0.0.1:8000');await offline.getByRole('button',{name:'直方体',exact:true}).click();assert.equal(await offline.locator('#save-stl').isDisabled(),false);await offline.locator('#fillet-top').check();await offline.waitForFunction(()=>document.querySelector('#errors').textContent.includes('読み込めません'));assert.equal(await offline.locator('#save-stl').isDisabled(),true);
 console.log('PASS: WASM初期化・併用加工・編集トレー・STL/SCAD一致・薄壁警告・格子制限・画面幅・エンジン失敗時の既存機能');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
