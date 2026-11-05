const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../fillet'),M=require('../mesh'),O=require('../organizer'),L=require('../layout');
const dims={block:{width:40,depth:30,height:20},box:{width:40,depth:30,height:20,wall:2,bottom:2},tray:Object.fromEntries(O.fields.map(([k,,v])=>[k,v])),grid:Object.fromEntries(O.fields.map(([k,,v])=>[k,v]))};
for(const type of Object.keys(dims))test(type+': OFF/0は以前と同一、対応範囲とメッシュ',()=>{
 const v={...dims[type]},old=M.createMesh(type,v),settings=F.defaults();
 assert.deepEqual(M.createMesh(type,{...v,fillet:settings}),old);settings.vertical.enabled=true;settings.vertical.radius=0;assert.deepEqual(M.createMesh(type,{...v,fillet:settings}),old);
 settings.vertical.radius=2;
 if(type==='grid'){assert.ok(F.validate(type,{...v,fillet:settings}).errors.length);assert.throws(()=>M.createMesh(type,{...v,fillet:settings}));return;}
 const m=M.createMesh(type,{...v,fillet:settings}),quality=M.validateMesh(m),original=M.validateMesh(old);assert.ok(quality.volume<original.volume);
 const w=type==='tray'?98:40,d=type==='tray'?66:30,h=type==='tray'?27:20;
 for(const [i,n]of [[0,w],[1,d],[2,h]]){assert.equal(Math.min(...m.vertices.map(p=>p[i])),0);assert.equal(Math.max(...m.vertices.map(p=>p[i])),n);}
 assert.ok(Math.abs(original.volume-quality.volume-(4-4*24*Math.sin(Math.PI/48)/2)*4*h)<0.001);
 assert.ok(m.vertices.some(p=>p[0]===2&&p[1]===0));assert.ok(!m.vertices.some(p=>p[0]===0&&p[1]===0));
 require('./mesh-intersections.cjs')(m);
 M.toSTL(m);assert.match(F.code(m),/polyhedron/);
 settings.vertical.radius=99;assert.ok(F.validate(type,{...v,fillet:settings}).errors.length);
});
test('編集したトレーにも適用、内寸とレイアウトは維持',()=>{
 const v={...dims.tray},e=L.toggle(L.initial(v),'v:0:0');e.x[0]=18.5;v.edit=e;v.fillet=F.defaults();v.fillet.vertical.enabled=true;
 const before=JSON.stringify(e),m=M.createMesh('tray',v);M.validateMesh(m);require('./mesh-intersections.cjs')(m);assert.equal(JSON.stringify(v.edit),before);
 // 内壁・仕切りの座標はそのまま。
 assert.ok(m.vertices.some(p=>p[0]===20.5));assert.ok(m.vertices.some(p=>p[0]===2&&p[1]===2));
});
test('未対応エッジ・負半径・薄壁を拒否し自動縮小しない',()=>{
 for(const key of ['top','bottom','vertical']){const s=F.defaults();s[key].enabled=true;assert.ok(F.validate('grid',{...dims.grid,fillet:s}).errors.some(s=>s.includes('未対応')));}
 const s=F.defaults();s.vertical.enabled=true;s.vertical.radius=2;assert.ok(F.validate('box',{...dims.box,wall:0.5,fillet:s}).errors.length);assert.equal(s.vertical.radius,2);
 s.vertical.radius=-1;assert.ok(F.validate('block',{...dims.block,fillet:s}).errors.length);
});
test('頂点リンクが単一の輪（非多様体頂点を作らない）',()=>{
 for(const type of ['block','box','tray']){
  const v={...dims[type],fillet:F.defaults()};v.fillet.vertical.enabled=true;const mesh=M.createMesh(type,v),links=new Map();
  for(const face of mesh.faces)face.forEach((id,i)=>{if(!links.has(id))links.set(id,new Map());const map=links.get(id),a=face[(i+1)%3],b=face[(i+2)%3];for(const [x,y]of [[a,b],[b,a]]){if(!map.has(x))map.set(x,[]);map.get(x).push(y);}});
  for(const map of links.values()){
   for(const neighbors of map.values())assert.equal(neighbors.length,2);const seen=new Set(),queue=[map.keys().next().value];while(queue.length){const x=queue.pop();if(seen.has(x))continue;seen.add(x);queue.push(...map.get(x).filter(x=>!seen.has(x)));}assert.equal(seen.size,map.size);
  }
 }
});
test('交差検出テストが意図的な不正三角形を検出',()=>{
 assert.throws(()=>require('./mesh-intersections.cjs')({vertices:[[-1,0,0],[1,0,0],[0,1,0],[0,0.3,-1],[0,0.3,1],[0.5,0.3,0]],faces:[[0,1,2],[3,4,5]]}),/intersection/);
});
