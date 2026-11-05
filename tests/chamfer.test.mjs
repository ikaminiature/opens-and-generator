import Module from '../vendor/manifold/manifold.js';
import {createRequire}from 'node:module';
const require=createRequire(import.meta.url),{test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../chamfer'),F=require('../fillet'),M=require('../mesh'),O=require('../organizer'),L=require('../layout');
const engine=await Module();engine.setup();Core.install(engine);
const defaults=Object.fromEntries(O.fields.map(([k,,v])=>[k,v]));
function dims(type){return type==='tray'||type==='grid'?{...defaults}:{width:40,depth:30,height:20,wall:2,bottom:2};}
function setup(type,combination=true){const v=dims(type);v.fillet=F.defaults();if(type!=='grid'){v.fillet.top.enabled=true;v.fillet.bottom.enabled=true;v.fillet.vertical.enabled=combination;}if(type==='grid'||type==='tray')v.fillet.divider.enabled=true;return v;}
for(const type of ['block','box','tray','grid'])for(const rounded of [false,true])test(`${type} rounded=${rounded}: 45度面取り・実寸・多様体・自己交差`,()=>{
 const v=setup(type,rounded),m=M.createMesh(type,v),raw=M.createMesh(type,{...v,fillet:undefined}),q=M.validateMesh(m);
 assert.ok(q.volume<M.validateMesh(raw).volume);M.toSTL(m);
 for(let axis=0;axis<3;axis++){
  assert.ok(Math.min(...m.vertices.map(p=>p[axis]))>=Math.min(...raw.vertices.map(p=>p[axis]))-0.00001);
  assert.ok(Math.max(...m.vertices.map(p=>p[axis]))<=Math.max(...raw.vertices.map(p=>p[axis]))+0.00001);
 }
 // Independent geometry check of bevel normals: vertical and horizontal components match.
 let slopes=0;for(const f of m.faces){const [a,b,c]=f.map(i=>m.vertices[i]),u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],h=Math.hypot(n[0],n[1]);if(h>1e-6&&Math.abs(n[2])>1e-6){assert.ok(Math.abs(h/Math.abs(n[2])-1)<0.005);slopes++;}}
 assert.ok(slopes>0);require('./mesh-intersections.cjs')(m);
 // Verify manifold vertex links, not just edge incidence.
 const links=new Map();for(const face of m.faces)face.forEach((id,i)=>{if(!links.has(id))links.set(id,new Map());const map=links.get(id),a=face[(i+1)%3],b=face[(i+2)%3];for(const[x,y]of [[a,b],[b,a]]){if(!map.has(x))map.set(x,[]);map.get(x).push(y);}});
 for(const map of links.values()){for(const n of map.values())assert.equal(n.length,2);const seen=new Set(),queue=[map.keys().next().value];while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...map.get(id).filter(i=>!seen.has(i)));}assert.equal(seen.size,map.size);}
});
test('幅は水平・垂直の切り取り距離',()=>{
 const v=dims('block');v.fillet=F.defaults();v.fillet.top.enabled=true;const m=M.createMesh('block',v),z=v.height;
 assert.ok(m.vertices.some(p=>Math.abs(p[0]-0.5)<1e-5&&Math.abs(p[2]-z)<1e-5));assert.ok(m.vertices.some(p=>Math.abs(p[0])<1e-5&&Math.abs(p[2]-(z-0.5))<1e-5));
});
test('削除・移動・T字・十字・孤立部品・20×20',()=>{
 for(const type of ['tray','grid'])for(const count of [4,20]){
  const v=setup(type),e=L.initial({...v,columns:count,rows:count});v.columns=count;v.rows=count;v.edit=L.toggle(L.toggle(e,'v:0:0'),'h:1:1');v.edit=L.move(v.edit,v,'x',0,18.5);
  const before=JSON.stringify(v.edit),m=M.createMesh(type,v);M.validateMesh(m);if(count===4)require('./mesh-intersections.cjs')(m);assert.equal(JSON.stringify(v.edit),before);
 }
});
test('0/OFFは原状維持・干渉と適用対象の検証',()=>{
 for(const type of ['block','box','tray','grid']){const v=dims(type),f=F.defaults();assert.deepEqual(M.createMesh(type,{...v,fillet:f}),M.createMesh(type,v));for(const s of Object.values(f)){s.enabled=true;s.radius=0;}assert.deepEqual(M.createMesh(type,{...v,fillet:f}),M.createMesh(type,v));}
 for(const [type,patch]of [['box',{wall:0.2}],['tray',{divider:0.2}],['grid',{divider:0.2}],['box',{bottom:0.2}]])assert.ok(F.validate(type,{...setup(type),...patch}).errors.length);
 const g=setup('grid');g.fillet.top.enabled=true;assert.ok(F.validate('grid',g).errors.length);
 const b=setup('block');b.fillet.divider.enabled=true;assert.ok(F.validate('block',b).errors.length);
});
