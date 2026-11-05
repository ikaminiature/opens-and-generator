(function(root){
 const entries=[['top','外周の上端',1],['vertical','外周の縦角',2],['bottom','外周の底面側エッジ',0.5],['divider','内部仕切りの上端',0.5]];
 const defaults=()=>Object.fromEntries(entries.map(([k,,r])=>[k,{enabled:false,radius:r}]));
 function validate(type,v){
  const settings=v.fillet||defaults(),errors=[],warnings=[];
  for(const [key,label]of entries){const s=settings[key];if(!s||typeof s.enabled!=='boolean'||typeof s.radius!=='number'||!Number.isFinite(s.radius)||s.radius<0){errors.push(`${label}の半径は0以上の数値で入力してください。`);continue;}
   if(s.enabled&&s.radius>0&&(key!=='vertical'||type==='grid'))errors.push(`${label}はこの形状では未対応です。OFFまたは半径0にしてください。`);
  }
  const r=settings.vertical?.enabled?settings.vertical.radius:0;
  if(r>0&&type!=='grid'){
   const w=type==='tray'?v.columns*v.cellWidth+(v.columns-1)*v.divider+2*v.outerWall:v.width;
   const d=type==='tray'?v.rows*v.cellDepth+(v.rows-1)*v.divider+2*v.outerWall:v.depth;
   const limit=type==='block'?Math.min(w,d)/2:type==='box'?v.wall:v.outerWall;
   if(r>limit||r*2>=Math.min(w,d))errors.push(`外周縦角の半径が大きすぎます。この形状では${limit} mm以下、かつ幅・奥行きの半分未満にしてください。自動縮小はしません。`);
  }
  if(errors.length)warnings.push(...errors);
  return {errors,warnings,radius:r};
 }
 function mesh(type,v){
  const check=validate(type,v);if(check.errors.length)throw new Error(check.errors.join(' '));
  const R=check.radius;if(!(R>0))return null;
  const O=typeof module!=='undefined'&&module.exports?require('./organizer'):root.Organizer;
  let x,y,z,filled,W,D;
  if(type==='block'){W=v.width;D=v.depth;x=[0,W];y=[0,D];z=[0,v.height];filled=()=>true;}
  else{
   const a=type==='box'?{columns:1,rows:1,cellWidth:v.width-2*v.wall,cellDepth:v.depth-2*v.wall,divider:v.wall,outerWall:v.wall,base:v.bottom,wallHeight:v.height-v.bottom}:v;
   const l=O.layout(a,'tray');x=l.x;y=l.y;W=l.width;D=l.depth;z=[0,a.base,l.height];filled=(i,j,k)=>k===0||l.occupied(i,j);
  }
  // 24 segments per quarter circle. Radius is never scaled or expanded.
  const boundary=[];
  for(const [cx,cy,start]of [[W-R,R,-90],[W-R,D-R,0],[R,D-R,90],[R,R,180]])for(let n=0;n<=24;n++){
   const angle=(start+n*90/24)*Math.PI/180;boundary.push([cx+R*Math.cos(angle),cy+R*Math.sin(angle)]);
  }
  const clip=(poly,a,b)=>{
   const side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),out=[];
   for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=side(p),w=side(q),pin=u>=-1e-10,qin=w>=-1e-10;
    if(pin)out.push(p);if(pin!==qin){const t=u/(u-w);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}
   return out;
  };
  const vertices=[],ids=new Map(),surfaces=new Map();
  function vertex(p,h){const q=[...p,h].map(n=>Math.fround(Math.abs(n)<1e-10?0:n)),key=q.join(',');if(!ids.has(key)){ids.set(key,vertices.length);vertices.push(q);}return ids.get(key);}
  function face(f){const key=[...f].sort((a,b)=>a-b).join(',');if(surfaces.has(key))surfaces.delete(key);else surfaces.set(key,f);}
  for(let i=0;i<x.length-1;i++)for(let j=0;j<y.length-1;j++){
   let poly=[[x[i],y[j]],[x[i+1],y[j]],[x[i+1],y[j+1]],[x[i],y[j+1]]];
   for(let b=0;b<boundary.length&&poly.length;b++)poly=clip(poly,boundary[b],boundary[(b+1)%boundary.length]);
   const p=[];for(const q of poly){const f=q.map(Math.fround);if(!p.length||f.some((n,k)=>n!==p.at(-1)[k]))p.push(f);}if(p.length>1&&p[0].every((n,k)=>n===p.at(-1)[k]))p.pop();
   if(p.length<3)continue;
   for(let k=0;k<z.length-1;k++)if(filled(i,j,k)){
    const lo=p.map(q=>vertex(q,z[k])),hi=p.map(q=>vertex(q,z[k+1]));
    face([...lo].reverse());face(hi);for(let a=0;a<p.length;a++){const b=(a+1)%p.length;face([lo[a],lo[b],hi[b],hi[a]]);}
   }
  }
  const faces=[];
  for(const f of surfaces.values())for(let i=1;i<f.length-1;i++){
   const a=vertices[f[0]],b=vertices[f[i]],c=vertices[f[i+1]],u=b.map((n,k)=>n-a[k]),w=c.map((n,k)=>n-a[k]);
   if(Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])>0)faces.push([f[0],f[i],f[i+1]]);
  }
  // No display transform is applied. Output is in original mm coordinates.
  return {vertices,faces};
 }
 function code(mesh){return `// 外周縦角フィレット / 単位:mm / STLと同じ96分割相当の境界メッシュ\npolyhedron(\n  points=${JSON.stringify(mesh.vertices)},\n  faces=${JSON.stringify(mesh.faces.map(f=>[...f].reverse()))},\n  convexity=20\n);\n`;}
 const api={entries,defaults,validate,mesh,code};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Fillet=api;
})(typeof globalThis!=='undefined'?globalThis:this);
