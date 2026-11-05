const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../organizer'),M=require('../mesh');
const defaults=Object.fromEntries(O.fields.map(([k,,v])=>[k,v]));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>a.map((x,i)=>x-b[i]);
function inside(tris,p){return Math.abs(tris.reduce((sum,t)=>{const [a,b,c]=t.map(q=>sub(q,p)),len=v=>Math.hypot(...v);return sum+2*Math.atan2(dot(a,cross(b,c)),len(a)*len(b)*len(c)+dot(a,b)*len(c)+dot(b,c)*len(a)+dot(c,a)*len(b));},0))>2*Math.PI;}
for(const kind of ['tray','grid'])for(const [columns,rows]of [[1,1],[1,2],[1,5],[4,1],[2,2],[3,4],[20,20]])test(`${kind} ${columns}×${rows}: 外寸・閉鎖性・空間・体積`,()=>{
 const r=O.generate({...defaults,columns,rows,cellWidth:8.5,cellDepth:7.25,divider:1.25,outerWall:1.5,base:1.25,wallHeight:12.5},kind);
 if(kind==='grid'&&columns===1&&rows===1){assert.ok(r.errors.length);return;}
 assert.deepEqual(r.errors,[]);assert.equal(r.count,columns*rows);
 const {values:v,layout:l}=r,mesh=M.createMesh(kind,v),buffer=M.toSTL(mesh),d=new DataView(buffer),tris=[],edges=new Map(),seen=new Set();let volume=0;
 for(let i=0;i<d.getUint32(80,true);i++){
  const f=Array.from({length:12},(_,j)=>d.getFloat32(84+50*i+4*j,true)),t=[f.slice(3,6),f.slice(6,9),f.slice(9,12)],[a,b,c]=t,n=cross(sub(b,a),sub(c,a));
  assert.ok(Math.hypot(...n)>0);assert.ok(dot(n,f.slice(0,3))/Math.hypot(...n)>0.99999);
  const keys=t.map(p=>p.join(',')),key=[...keys].sort().join('|');assert.ok(!seen.has(key));seen.add(key);
  keys.forEach((a,j)=>{const b=keys[(j+1)%3],k=[a,b].sort().join('|'),e=edges.get(k)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(k,e);});
  volume+=dot(a,cross(b,c))/6;tris.push(t);
 }
 for(const [count,balance]of edges.values()){assert.equal(count,2);assert.equal(balance,0);}
 let area=0;for(let i=0;i<l.x.length-1;i++)for(let j=0;j<l.y.length-1;j++)if(l.occupied(i,j))area+=(l.x[i+1]-l.x[i])*(l.y[j+1]-l.y[j]);
 assert.ok(Math.abs(volume/((kind==='tray'?l.width*l.depth*v.base:0)+area*v.wallHeight)-1)<1e-6);
 const points=tris.flat();for(const [axis,size]of [[0,l.width],[1,l.depth],[2,l.height]])assert.ok(Math.abs(Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]))-size)<1e-5);
 // 代表的なマス中心：底板上の空間を塞がない。底あり/なしを区別。
 const x=(kind==='tray'?v.outerWall:0)+v.cellWidth/2-l.minX,y=(kind==='tray'?v.outerWall:0)+v.cellDepth/2-l.minY;
 assert.equal(inside(tris,[x,y,l.height/2+(kind==='tray'?v.base/2:0)]),false);
 assert.equal(inside(tris,[x,y,v.base/2]),kind==='tray');
 if(columns>1&&rows>1){const a=(kind==='tray'?v.outerWall:0)+v.cellWidth+v.divider/2-l.minX,b=(kind==='tray'?v.outerWall:0)+v.cellDepth+v.divider/2-l.minY;assert.equal(inside(tris,[a,b,l.height/2]),true);}
 if(kind==='tray'||(columns>1&&rows>1)){
  const visited=new Set([0]);let previous=0;while(previous!==visited.size){previous=visited.size;for(const f of mesh.faces)if(f.some(i=>visited.has(i)))f.forEach(i=>visited.add(i));}assert.equal(visited.size,mesh.vertices.length,'連続した一体構造');
 }
});
test('内寸・外寸の式とケース各側クリアランス・造形範囲',()=>{
 const r=O.generate({...defaults,caseWidth:100,caseDepth:70,caseHeight:30});
 assert.equal(r.layout.width,98);assert.equal(r.layout.depth,66);assert.equal(r.layout.height,27);assert.equal(r.count,6);
 assert.deepEqual(r.clearance,{Width:1,Depth:2,Height:3});assert.equal(r.fits,'収まります');
 assert.equal(O.generate({...defaults,caseWidth:98.5}).fits,'クリアランス不足');
 assert.equal(O.generate({...defaults,caseWidth:97}).fits,'収まりません');
 assert.ok(O.generate({...defaults,caseHeight:20}).warnings.some(s=>s.includes('高さ')));
 assert.ok(O.generate({...defaults,columns:20}).warnings.some(s=>s.includes('造形範囲')));
 assert.equal(O.generate(defaults).fits,'未入力の方向は未判定');
 const l=r.layout;for(let i=1;i<l.x.length-2;i+=2)assert.equal(l.x[i+1]-l.x[i],30);
});
test('不正な寸法・数・任意入力と非表示項目',()=>{
 for(const patch of [{divider:0},{wallHeight:-1},{base:0},{columns:0},{rows:21},{rows:1.5},{caseGap:-0.1},{caseWidth:0},{printHeight:''},{cellWidth:NaN},{cellWidth:1e40},{divider:1e-20}])assert.ok(O.generate({...defaults,...patch}).errors.length);
 assert.deepEqual(O.generate({...defaults,base:'',outerWall:''},'grid').errors,[]);
});
