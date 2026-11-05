(function(root){
 function install(engine){
  const {Manifold,Mesh}=engine;let cachedKey='',cachedMesh=null;
  function apply(type,v,source){
   const key=JSON.stringify([type,v]);if(key===cachedKey)return cachedMesh;
   const c=k=>v.fillet[k].enabled?v.fillet[k].radius:0;
   const points=source.vertices,faces=source.faces,H=Math.max(...points.map(p=>p[2])),W=Math.max(...points.map(p=>p[0])),D=Math.max(...points.map(p=>p[1])),R=c('vertical');
   const eps=Math.max(W,D,H,1)*1e-6,wall=type==='box'?v.wall:v.outerWall;
   function outer(p){
    if(Math.min(Math.abs(p[0]),Math.abs(p[0]-W),Math.abs(p[1]),Math.abs(p[1]-D))<eps)return true;
    if(R>0)for(const [x,y,sx,sy]of [[R,R,-1,-1],[W-R,R,1,-1],[W-R,D-R,1,1],[R,D-R,-1,1]])if((p[0]-x)*sx>=-eps&&(p[1]-y)*sy>=-eps&&Math.abs(Math.hypot(p[0]-x,p[1]-y)-R)<eps)return true;
    return false;
   }
   function perimeter(a,b){
    if(type==='block'||type==='box')return true;
    if(type==='grid')return false;
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    return (outer(a)&&outer(b))||m[0]<=wall+eps||m[0]>=W-wall-eps||m[1]<=wall+eps||m[1]>=D-wall-eps;
   }
   const groups=new Map();
   for(const bottom of [false,true]){
    const level=bottom?0:H,edges=new Map();
    for(const f of faces)if(f.every(i=>Math.abs(points[i][2]-level)<eps)){
     f.forEach((a,i)=>{const b=f[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);});
    }
    for(const [ia,ib]of edges.values()){
     const a=points[ia],b=points[ib],width=bottom?c('bottom'):c(perimeter(a,b)?'top':'divider');if(!width)continue;
     const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<eps)continue;
     const dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length;
     const sign=bottom?-1:1,nx=-dy*sign,ny=dx*sign;
     const line=a[0]*nx+a[1]*ny,id=[bottom,width,nx.toFixed(7),ny.toFixed(7),line.toFixed(5)].join('|');
     if(!groups.has(id))groups.set(id,{bottom,width,nx,ny,dx,dy,line,intervals:[]});groups.get(id).intervals.push([a[0]*dx+a[1]*dy,b[0]*dx+b[1]*dy].sort((a,b)=>a-b));
    }
   }
   const solids=[];let solid=null;
   try{
    const input=new Mesh({numProp:3,vertProperties:new Float32Array(points.flat()),triVerts:new Uint32Array(faces.flat())});
    solid=new Manifold(input);if(solid.status()!=='NoError')throw new Error('入力メッシュが閉じていません。');
    for(const g of groups.values()){
     const {bottom,width,nx,ny,dx,dy,line}=g,merged=[];g.intervals.sort((a,b)=>a[0]-b[0]);
     for(const range of g.intervals){if(merged.length&&range[0]<=merged.at(-1)[1]+eps)merged.at(-1)[1]=Math.max(merged.at(-1)[1],range[1]);else merged.push([...range]);}
     for(const [lo,hi]of merged){
      // Right-isosceles triangle cut: horizontal distance == vertical distance.
      // A small outside allowance avoids coincident boolean surfaces; the 45° plane remains exact.
      const outside=Math.max(0.01,width/10),z=bottom?0:H,dz=bottom?1:-1;
      const cross=[[-outside,-outside],[width+outside,-outside],[-outside,width+outside]];
      const vertices=[];for(const t of [lo,hi])for(const [n,h]of cross)vertices.push([dx*t+nx*(line+n),dy*t+ny*(line+n),z+dz*h]);
      const tool=Manifold.hull(vertices);solids.push(tool);
     }
    }
    if(solids.length){const cutters=Manifold.union(solids);try{const next=solid.subtract(cutters);solid.delete();solid=next;}finally{cutters.delete();}}
    if(solid.status()!=='NoError'||solid.isEmpty())throw new Error('面取り形状を生成できませんでした。');
    const out=solid.getMesh(),vertices=[],ids=new Map(),remap=[];
    for(let i=0;i<out.vertProperties.length/out.numProp;i++){
     const p=Array.from(out.vertProperties.slice(i*out.numProp,i*out.numProp+3)),key=p.join(',');
     if(!ids.has(key)){ids.set(key,vertices.length);vertices.push(p);}remap.push(ids.get(key));
    }
    const tri=out.triVerts,result={vertices,faces:Array.from({length:tri.length/3},(_,i)=>Array.from(tri.slice(i*3,i*3+3),n=>remap[n]))};
    // Float32 STL coordinates can collapse sub-ULP boolean slivers. Weld exact
    // coordinates and discard only zero-area triangles, then require closure.
    result.faces=result.faces.filter(f=>{
     const [a,b,c]=f.map(i=>vertices[i]),u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
     return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>0;
    });
    root.ScadMesh?.validateMesh(result);cachedKey=key;cachedMesh=result;return result;
   } finally {solid?.delete();for(const s of solids)s.delete();}
  }
  root.Chamfer={apply};return root.Chamfer;
 }
 const api={install};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChamferCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
