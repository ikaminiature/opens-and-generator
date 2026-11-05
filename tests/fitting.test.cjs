const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../fitting'), M=require('../mesh');
const defaults=Object.fromEntries(F.fields.map(([k,,v])=>[k,v]));
const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function inside(tris,p) {
 const angle=tris.reduce((s,t)=>{const [a,b,c]=t.map(q=>q.map((n,i)=>n-p[i])),l=v=>Math.hypot(...v);return s+2*Math.atan2(dot(a,cross(b,c)),l(a)*l(b)*l(c)+dot(a,b)*l(c)+dot(b,c)*l(a)+dot(c,a)*l(b));},0);
 return Math.abs(angle)>2*Math.PI;
}
for(const segments of [24,96,384]) for(const clearance of [-0.2,0,0.3]) for(const part of ['A','B']) test(`${part} fn=${segments} clearance=${clearance}: STL実寸・閉鎖性・内部`,()=>{
 const v={...defaults,clearance}, mesh=M.createMesh('fitting'+part,v,segments), buffer=M.toSTL(mesh),d=new DataView(buffer),tris=[];
 const edges=new Map(),seen=new Set();let volume=0;
 for(let i=0;i<d.getUint32(80,true);i++) {
   const f=Array.from({length:12},(_,j)=>d.getFloat32(84+i*50+j*4,true));
   const t=[f.slice(3,6),f.slice(6,9),f.slice(9,12)], [a,b,c]=t;
   const n=cross(b.map((x,j)=>x-a[j]),c.map((x,j)=>x-a[j]));
   assert.ok(Math.hypot(...n)>0);assert.ok(dot(n,f.slice(0,3))/Math.hypot(...n)>0.99999);
   const keys=t.map(p=>p.join(',')),key=[...keys].sort().join('|');assert.ok(!seen.has(key));seen.add(key);
   keys.forEach((a,j)=>{const b=keys[(j+1)%3],k=[a,b].sort().join('|'),e=edges.get(k)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(k,e);});
   volume+=dot(a,cross(b,c))/6;tris.push(t);
 }
 for(const [count,balance] of edges.values()){assert.equal(count,2);assert.equal(balance,0);}
 const visited=new Set([0]);let previous=0;
 while(previous!==visited.size){previous=visited.size;for(const face of mesh.faces)if(face.some(i=>visited.has(i)))face.forEach(i=>visited.add(i));}
 assert.equal(visited.size,mesh.vertices.length,'単一の接続したソリッド');
 const area=segments/2*Math.sin(2*Math.PI/segments),hole=v.pinDiameter+v.clearance;
 const expected=part==='A'?area*((v.aDiameter/2)**2*v.aThickness+(v.pinDiameter/2)**2*v.pinHeight):area*((v.bDiameter/2)**2*v.bThickness-(hole/2)**2*v.holeDepth);
 assert.ok(Math.abs(volume/expected-1)<1e-6);
 const points=tris.flat(),max=axis=>Math.max(...points.map(p=>p[axis])),min=axis=>Math.min(...points.map(p=>p[axis]));
 assert.ok(Math.abs(max(0)-min(0)-(part==='A'?v.aDiameter:v.bDiameter))<1e-5);
 assert.equal(min(2),0);assert.equal(max(2),part==='A'?v.aThickness+v.pinHeight:v.bThickness);
 if(part==='A') {
   assert.equal(inside(tris,[0,0,v.aThickness-0.1]),true);assert.equal(inside(tris,[0,0,v.aThickness+0.1]),true);
   // Aの接合面にある水平面は凸部の外側の環だけ。
   for(const t of tris.filter(t=>t.every(p=>p[2]===v.aThickness))) assert.ok(t.every(p=>Math.hypot(p[0],p[1])>=v.pinDiameter/2-1e-5));
 } else {
   const floor=v.bThickness-v.holeDepth;
   assert.equal(inside(tris,[0,0,floor-0.1]),true);assert.equal(inside(tris,[0,0,floor+0.1]),false);
   const radii=[...new Set(points.filter(p=>p[2]===v.bThickness).map(p=>Math.hypot(p[0],p[1])))];
   assert.ok(Math.abs(2*Math.min(...radii)-hole)<1e-5);
   assert.ok(Math.abs((2*Math.min(...radii)-v.pinDiameter)-clearance)<1e-5);
 }
});
test('寸法エラー・警告・SCAD出力',()=>{
 for(const patch of [{holeDepth:9},{holeDepth:7},{minBottom:9},{pinDiameter:30},{clearance:-11},{bDiameter:10},{pinHeight:''},{clearance:''}])assert.ok(F.generate({...defaults,...patch}).errors.length);
 assert.equal(F.generate({...defaults,holeDepth:6}).errors.length,0,'最小厚さと等しくても可');
 for(const clearance of [-0.2,0]){const r=F.generate({...defaults,clearance});assert.equal(r.errors.length,0);assert.match(r.warnings.join(''),/干渉/);}
 const r=F.generate({...defaults,pinHeight:7});assert.equal(r.errors.length,0);assert.match(r.warnings.join(''),/完全には差し込めません/);
 assert.match(r.codeA,/union/);assert.match(r.codeB,/difference/);assert.match(r.codeB,/8 - 5.5/);
});
test('組み立てはA反転・正しい差し込み高さ、分離は並列',()=>{
 for(const pinHeight of [3,5.5,8]){
  const v={...defaults,pinHeight},p=F.placement(v,true);assert.equal(p.flip,true);
  const joint=p.a[2]-v.aThickness,tip=joint-v.pinHeight;
  assert.equal(joint,v.bThickness+Math.max(0,pinHeight-v.holeDepth));
  assert.ok(tip>=v.bThickness-v.holeDepth);assert.ok(tip<v.bThickness);
 }
 const p=F.placement(defaults,false);assert.equal(p.flip,false);assert.ok(p.b[0]-p.a[0]>(defaults.aDiameter+defaults.bDiameter)/2);
});
