const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),O=require('../organizer'),M=require('../mesh');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');await page.waitForSelector('#preview[data-ready="true"]');await page.getByRole('button',{name:'収納トレー・格子',exact:true}).click();
 const wall=()=>page.locator('[data-wall="v:0:0"]');await wall().tap();
 assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),['v:0:0']);
 await page.locator('#layout-undo').click();assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),[]);
 await page.locator('#layout-redo').click();assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),['v:0:0']);
 await page.locator('[data-edit-mode="move"]').click();await wall().tap();await page.locator('#layout-position').fill('18.5');await page.locator('#layout-apply').click();
 assert.equal(await page.evaluate(()=>organizerUI.get().raw.edit.x[0]),18.5);assert.match(await page.locator('#layout-sizes').textContent(),/18.5/);
 // CDPによる1本指ドラッグ。境界の残存区間と削除区間が同時移動。
 await page.locator('#layout-plan').scrollIntoViewIfNeeded();const cdp=await page.context().newCDPSession(page),box=await page.locator('[data-wall="v:0:1"]').boundingBox();
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const moved=await page.evaluate(()=>organizerUI.get().raw.edit.x[0]);assert.ok(moved>18.5);assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),['v:0:0']);
 await page.locator('#layout-undo').click();assert.equal(await page.evaluate(()=>organizerUI.get().raw.edit.x[0]),18.5);await page.locator('#layout-redo').click();
 for(const kind of ['tray','grid']){
  await page.locator('#organizer-kind').selectOption(kind);const state=await page.evaluate(()=>organizerUI.get());
  for(const format of ['stl','scad']){const downloading=page.waitForEvent('download');await page.locator(format==='stl'?'#save-stl':'#save').click();const d=await downloading,r=O.generate(state.raw,kind);assert.deepEqual(fs.readFileSync(await d.path()),format==='stl'?Buffer.from(M.toSTL(M.createMesh(kind,r.values))):Buffer.from(r.code));}
 }
 await page.locator('#layout-store').click();const downloading=page.waitForEvent('download');await page.locator('#layout-json').click();const json=await downloading,path=await json.path(),saved=fs.readFileSync(path,'utf8');
 await page.locator('#layout-reset').click();assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),[]);
 await page.locator('#layout-file').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(saved)});await page.waitForFunction(()=>organizerUI.get().raw.edit.removed.includes('v:0:0'));assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),['v:0:0']);
 await page.reload();await page.getByRole('button',{name:'収納トレー・格子',exact:true}).click();await page.locator('#layout-restore').click();assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),['v:0:0']);
 await page.locator('#layout-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":999}')});await page.waitForFunction(()=>document.querySelector('#layout-status').textContent.includes('読み込めません'));
 assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),['v:0:0']);
 await page.locator('#layout-reset').click();await page.locator('[data-edit-mode="toggle"]').click();await page.locator('[data-wall="h:0:0"]').tap();await page.locator('[data-wall="h:0:0"]').tap();assert.deepEqual(await page.evaluate(()=>organizerUI.get().raw.edit.removed),[]);
 for(const width of [390,820]){await page.setViewportSize({width,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('PASS: タップ削除復元・数値位置・指ドラッグ・Undo/Redo・両形状STL/SCAD内容・JSON・ブラウザ保存復元・不正JSON・画面幅');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
