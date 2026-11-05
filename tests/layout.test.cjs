const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../layout'),O=require('../organizer'),M=require('../mesh');
const raw=Object.fromEntries(O.fields.map(([k,,v])=>[k,v]));
for(const kind of ['tray','grid'])for(const counts of [[3,2],[4,4],[20,20]])test(`${kind} ${counts}: 削除・移動メッシュ`,()=>{
 const v={...raw,columns:counts[0],rows:counts[1]};let e=L.initial(v);
 e=L.toggle(e,'v:0:0');e=L.toggle(e,'h:0:0');e=L.move(e,v,'x',0,18.5);e=L.move(e,v,'y',0,24.25);assert.ok(L.valid(e,v));
 const result=O.generate({...v,edit:e},kind);assert.deepEqual(result.errors,[]);assert.equal(result.regions,v.columns*v.rows-2);
 const mesh=M.createMesh(kind,result.values),quality=M.validateMesh(mesh);assert.ok(quality.volume>0);
 const baseline=M.validateMesh(M.createMesh(kind,O.generate({...v,edit:{...e,removed:[]}},kind).values));assert.ok(quality.volume<baseline.volume);
 // 出力バイナリを再解析：法線・辺の向き・重複面・面積・実寸。
 const buffer=M.toSTL(mesh),data=new DataView(buffer),edges=new Map(),seen=new Set();
 for(let i=0;i<data.getUint32(80,true);i++){
  const f=Array.from({length:12},(_,j)=>data.getFloat32(84+i*50+j*4,true)),points=[f.slice(3,6),f.slice(6,9),f.slice(9,12)],keys=points.map(p=>p.join(','));
  const key=[...keys].sort().join('|');assert.ok(!seen.has(key));seen.add(key);
  const [a,b,c]=points,u=b.map((x,j)=>x-a[j]),w=c.map((x,j)=>x-a[j]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  assert.ok(Math.hypot(...n)>0);assert.ok(n.reduce((s,x,j)=>s+x*f[j],0)/Math.hypot(...n)>0.9999);
  keys.forEach((a,j)=>{const b=keys[(j+1)%3],k=[a,b].sort().join('|'),val=edges.get(k)||[0,0];val[0]++;val[1]+=a<b?1:-1;edges.set(k,val);});
 }
 for(const [count,balance]of edges.values()){assert.equal(count,2);assert.equal(balance,0);}
 const l=result.layout,offset=kind==='tray'?1:0;
 assert.equal(l.x[offset+1],(kind==='tray'?v.outerWall:0)+18.5);
 assert.equal(l.occupied(offset+1,offset),false,'削除した縦区間は空');
 assert.equal(l.occupied(offset+1,offset+2),true,'同列の残した区間は移動して存在');
 assert.equal(l.occupied(offset,offset+1),false,'削除した横区間は空');
});
test('制約、削除復元、不正JSONデータ',()=>{
 const v={...raw},e=L.initial(v);assert.deepEqual(L.toggle(L.toggle(e,'v:0:0'),'v:0:0'),e);
 const low=L.move(e,v,'x',0,-100),high=L.move(e,v,'x',0,999);assert.equal(low.x[0],1);assert.equal(high.x[0],e.x[1]-v.divider-1);
 for(const bad of [{...e,x:[0,62]},{...e,x:[Infinity,62]},{...e,removed:['v:99:0']},{...e,version:2},{...e,removed:['v:0:0','v:0:0']}])assert.equal(L.valid(bad,v),false);
 assert.ok(O.generate({...v,edit:{...e,x:[0,62]}}).errors.length);
});
test('全削除のトレー、格子、孤立警告',()=>{
 const v={...raw,columns:3,rows:3},e=L.initial(v);
 e.removed=Array.from({length:2},(_,i)=>Array.from({length:3},(_,j)=>[`v:${i}:${j}`,`h:${i}:${j}`])).flat(2);
 const tray=O.generate({...v,edit:e},'tray');assert.deepEqual(tray.errors,[]);M.toSTL(O.createMesh(tray.values,'tray'));
 assert.ok(O.generate({...v,edit:e},'grid').errors.some(s=>s.includes('すべて')));
 e.removed=e.removed.filter(k=>!['v:0:0','v:1:2'].includes(k));
 assert.ok(O.generate({...v,edit:e},'grid').warnings.some(s=>s.includes('孤立')));
});
test('多様な区間削除後も閉じたメッシュ',()=>{
 let seed=12345;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(const kind of ['tray','grid'])for(let sample=0;sample<40;sample++){
  const v={...raw,columns:4,rows:4},e=L.initial(v);
  for(let i=0;i<3;i++)for(let j=0;j<4;j++)for(const a of ['v','h'])if(random()<0.65)e.removed.push(`${a}:${i}:${j}`);
  const r=O.generate({...v,edit:e},kind);if(r.errors.length){assert.equal(kind,'grid');continue;}
  assert.ok(M.validateMesh(O.createMesh(r.values,kind)).volume>0);
 }
});
