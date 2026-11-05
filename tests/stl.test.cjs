const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMesh, toSTL, filename } = require('../mesh');
const { generate } = require('../generator');
const fs = require('node:fs');
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
function decode(buffer) {
  const data=new DataView(buffer), n=data.getUint32(80,true), triangles=[];
  assert.equal(buffer.byteLength,84+50*n);
  for(let i=0;i<n;i++) {
    const values=Array.from({length:12},(_,j)=>data.getFloat32(84+i*50+j*4,true));
    triangles.push({normal:values.slice(0,3),points:[values.slice(3,6),values.slice(6,9),values.slice(9,12)]});
  }
  return triangles;
}
function inside(tris,p) {
  const angle=tris.reduce((sum,t)=>{
    const [a,b,c]=t.points.map(q=>sub(q,p));
    return sum+2*Math.atan2(dot(a,cross(b,c)),length(a)*length(b)*length(c)+dot(a,b)*length(c)+dot(b,c)*length(a)+dot(c,a)*length(b));
  },0);
  return Math.abs(angle)>2*Math.PI;
}
const cases=[
  ['cylinder',{diameter:30,height:20},[30,30,20]],
  ['disk',{diameter:40,hole:10,height:3},[40,40,3]],
  ['disk',{diameter:20,hole:0,height:2},[20,20,2]],
  ['block',{width:12.5,depth:20,height:3},[12.5,20,3]],
  ['box',{width:60,depth:40,height:30,wall:2,bottom:3},[60,40,30]],
  ['box',{width:9.5,depth:7.25,height:5.5,wall:0.75,bottom:1.25},[9.5,7.25,5.5]]
];
for(const [type,v,dimensions] of cases) for(const segments of [24,96,384]) {
  test(`${type} ${JSON.stringify(v)} fn=${segments}: 出力STL品質`,()=>{
    const buffer=toSTL(createMesh(type,v,segments)), tris=decode(buffer);
    const edges=new Map(), seen=new Set();let volume=0;
    for(const {normal:n,points:[a,b,c]} of tris) {
      const calculated=cross(sub(b,a),sub(c,a));assert.ok(length(calculated)>0);
      assert.ok(dot(n,calculated)/length(calculated)>0.99999);
      const keys=[a,b,c].map(p=>p.join(','));const key=[...keys].sort().join('|');
      assert.ok(!seen.has(key),'重複面なし');seen.add(key);
      keys.forEach((a,i)=>{const b=keys[(i+1)%3],key=[a,b].sort().join('|');const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);});
      volume+=dot(a,cross(b,c))/6;
    }
    for(const [count,balance] of edges.values()) { assert.equal(count,2,'各辺に2面');assert.equal(balance,0,'向きが一致'); }
    const vertices=tris.flatMap(t=>t.points);
    for(let i=0;i<3;i++) assert.ok(Math.abs(Math.max(...vertices.map(p=>p[i]))-Math.min(...vertices.map(p=>p[i]))-dimensions[i])<0.00001);
    const area=segments/2*Math.sin(2*Math.PI/segments);
    const expected=type==='cylinder'||type==='disk'?area*((v.diameter/2)**2-((v.hole||0)/2)**2)*v.height:type==='block'?v.width*v.depth*v.height:v.width*v.depth*v.height-(v.width-2*v.wall)*(v.depth-2*v.wall)*(v.height-v.bottom);
    assert.ok(Math.abs(volume/expected-1)<0.00001);
    if(type==='disk'&&v.hole>0) {assert.equal(inside(tris,[0,0,v.height/2]),false);assert.equal(inside(tris,[(v.diameter+v.hole)/4,0,v.height/2]),true);}
    if(type==='box') {
      assert.equal(inside(tris,[v.width/2,v.depth/2,(v.height+v.bottom)/2]),false);
      assert.equal(inside(tris,[v.width/2,v.depth/2,v.bottom/2]),true);
      assert.equal(inside(tris,[v.wall/2,v.depth/2,v.height/2]),true);
      assert.equal(inside(tris,[v.wall*1.1,v.depth/2,(v.height+v.bottom)/2]),false);
    }
    if(type==='cylinder'||(type==='disk'&&!v.hole)) assert.equal(inside(tris,[0,0,v.height/2]),true);
    assert.match(generate(type,v,segments).code,new RegExp(`\\$fn = ${segments};`));
    assert.match(filename(type,v,segments),new RegExp(`^${type}_.*height-${v.height}.*_mm`));
    if(segments===96) {fs.mkdirSync('/tmp/stl-validation',{recursive:true});fs.writeFileSync(`/tmp/stl-validation/${filename(type,v,segments)}`,Buffer.from(buffer));}
  });
}
test('精度不足・不正分割数を拒否',()=>{
  assert.throws(()=>toSTL(createMesh('box',{width:1e8,depth:1e8,height:1e8,wall:0.001,bottom:1})),/寸法/);
  assert.throws(()=>createMesh('cylinder',{diameter:30,height:20},5),/分割数/);
});
