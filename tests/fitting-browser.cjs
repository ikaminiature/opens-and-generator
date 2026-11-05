const { chromium }=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../fitting'),M=require('../mesh');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');
  await page.waitForSelector('#preview[data-ready="true"]');await page.getByRole('button',{name:'嵌合パーツ',exact:true}).click();
  assert.equal(await page.locator('#clearance').inputValue(),'0.3');assert.match(await page.locator('#fitting-summary').textContent(),/10.3 mm/);
  const v=Object.fromEntries(F.fields.map(([k,,v])=>[k,v]));
  for(const part of ['A','B'])for(const format of ['stl','scad']){
   const downloading=page.waitForEvent('download');await page.locator(`[data-part="${part}"][data-format="${format}"]`).click();const d=await downloading;
   assert.equal(d.suggestedFilename(),F.filename(part,v,96,format));
   const actual=fs.readFileSync(await d.path());const expected=format==='stl'?Buffer.from(M.toSTL(M.createMesh('fitting'+part,v))):Buffer.from(F.generate(v)[`code${part}`]);
   assert.deepEqual(actual,expected);
  }
  await page.locator('#output-part').selectOption('B');assert.match(await page.locator('#code').inputValue(),/difference/);
  await page.getByRole('button',{name:'組み立て',exact:true}).click();assert.equal(await page.locator('[data-assembly="assembled"]').getAttribute('aria-pressed'),'true');
  const geometry=await page.evaluate(async()=>{
   const T=await import('./vendor/three.module.js'),{createModel}=await import('./model.js');
   const v=Object.fromEntries(Object.entries(window.scadPreviewState.raw).map(([k,v])=>[k,Number(v)]));
   const material=new T.MeshBasicMaterial({color:'red'}),other=new T.MeshBasicMaterial({color:'blue'});
   const pair=createModel('fitting',v,material,96,true,other);pair.updateMatrixWorld(true);
   const a=pair.getObjectByName('partA'),b=pair.getObjectByName('partB');
   return {tip:a.localToWorld(new T.Vector3(0,0,v.aThickness+v.pinHeight)).toArray(),joint:a.localToWorld(new T.Vector3(0,0,v.aThickness)).toArray(),direction:new T.Vector3(0,0,1).transformDirection(a.matrixWorld).toArray(),colors:[a.children[0].material.color.getHex(),b.children[0].material.color.getHex()]};
  });
  assert.ok(Math.abs(geometry.tip[2]-3)<1e-5);assert.ok(Math.abs(geometry.joint[2]-8)<1e-5);assert.ok(geometry.direction[2]<-0.999);assert.notEqual(...geometry.colors);
  await page.locator('#pinHeight').fill('7');assert.match(await page.locator('#warnings').textContent(),/完全には差し込めません/);
  await page.locator('#clearance').fill('-0.2');assert.match(await page.locator('#warnings').textContent(),/干渉/);assert.equal(await page.locator('[data-part="A"][data-format="stl"]').isDisabled(),false);
  await page.locator('#holeDepth').fill('9');assert.equal(await page.locator('#errors').isVisible(),true);assert.equal(await page.locator('[data-part="B"][data-format="stl"]').isDisabled(),true);
  await page.locator('#holeDepth').fill('5.5');await page.getByRole('button',{name:'分離',exact:true}).click();
  for(const name of ['正面','上面','側面','全体'])await page.getByRole('button',{name,exact:true}).click();
  for(const width of [390,820]){await page.setViewportSize({width,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.getByRole('button',{name:'円柱',exact:true}).click();assert.equal(await page.locator('#save-stl').isVisible(),true);assert.equal(await page.locator('#fitting-downloads').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: 嵌合寸法・A/B個別STL/SCAD保存・警告/エラー・反転組み立て位置と色・分離・視点・画面幅・既存モード復帰');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
