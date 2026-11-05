(function (root) {
  // mm座標、Z上向き。プレビューとSTLで共有する境界面だけのメッシュ。
  function createMesh(type, v, segments = 96) {
    if (type === 'tray' || type === 'grid') {
      const organizer = typeof module !== 'undefined' && module.exports ? require('./organizer') : root.Organizer;
      return organizer.createMesh(v, type);
    }
    if (!Number.isInteger(segments) || segments < 12 || segments > 384 || segments % 4) throw new Error('円の分割数は12〜384の4の倍数にしてください。');
    const vertices = [], faces = [];
    const vertex = (x, y, z) => { vertices.push([x, y, z].map(Math.fround)); return vertices.length - 1; };
    const tri = (a, b, c) => faces.push([a, b, c]);
    const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
    function ring(radius, z) {
      return Array.from({ length: segments }, (_, i) => {
        const a = i * 2 * Math.PI / segments;
        // 軸上の微小な三角関数誤差を避ける。
        return vertex(i % (segments / 2) === 0 ? radius * (i === 0 ? 1 : -1) : i % (segments / 4) === 0 ? 0 : radius * Math.cos(a),
          i % (segments / 2) === 0 ? 0 : i % (segments / 4) === 0 ? radius * (i === segments / 4 ? 1 : -1) : radius * Math.sin(a), z);
      });
    }
    function rectangle(x, y, w, d, z) { return [[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(([a,b]) => vertex(a,b,z)); }
    function walls(bottom, top) { bottom.forEach((a,i) => { const j=(i+1)%bottom.length; quad(a,bottom[j],top[j],top[i]); }); }
    function rim(outer, inner) { outer.forEach((a,i) => { const j=(i+1)%outer.length; quad(a,outer[j],inner[j],inner[i]); }); }
    function cap(r, up) { for(let i=1;i<r.length-1;i++) up ? tri(r[0],r[i],r[i+1]) : tri(r[0],r[i+1],r[i]); }
    if (type === 'fittingA' || type === 'fittingB') {
      const isA = type === 'fittingA';
      const radius=(isA?v.aDiameter:v.bDiameter)/2, thickness=isA?v.aThickness:v.bThickness;
      const bottom=ring(radius,0), top=ring(radius,thickness);
      walls(bottom,top);
      const bc=vertex(0,0,0);
      bottom.forEach((a,i)=>tri(bc,bottom[(i+1)%segments],a));
      const innerTop=ring((isA?v.pinDiameter:v.pinDiameter+v.clearance)/2,thickness);
      rim(top,innerTop);
      const end=ring((isA?v.pinDiameter:v.pinDiameter+v.clearance)/2,isA?thickness+v.pinHeight:thickness-v.holeDepth);
      // Aは外向きの凸側面、Bは内向きの止まり穴側面。
      walls(innerTop,end);
      const center=vertex(0,0,isA?thickness+v.pinHeight:thickness-v.holeDepth);
      end.forEach((a,i)=>tri(center,a,end[(i+1)%segments]));
    } else if (type === 'cylinder' || type === 'disk') {
      const bottom = ring(v.diameter/2,0), top = ring(v.diameter/2,v.height);
      walls(bottom,top);
      if(type === 'disk' && v.hole > 0) {
        const ib=ring(v.hole/2,0), it=ring(v.hole/2,v.height);
        walls(it,ib); rim(top,it); rim(ib,bottom);
      } else {
        const bc=vertex(0,0,0), tc=vertex(0,0,v.height);
        bottom.forEach((a,i)=>{const j=(i+1)%segments;tri(bc,bottom[j],a);tri(tc,top[i],top[j]);});
      }
    } else if (type === 'block' || type === 'box') {
      const bottom=rectangle(0,0,v.width,v.depth,0), top=rectangle(0,0,v.width,v.depth,v.height);
      walls(bottom,top); cap(bottom,false);
      if(type === 'box') {
        const floor=rectangle(v.wall,v.wall,v.width-2*v.wall,v.depth-2*v.wall,v.bottom);
        const inner=rectangle(v.wall,v.wall,v.width-2*v.wall,v.depth-2*v.wall,v.height);
        rim(top,inner); walls(inner,floor); cap(floor,true);
      } else cap(top,true);
    } else throw new Error('対応していない形状です。');
    return { vertices, faces };
  }
  function normal(a,b,c) {
    const u=b.map((x,i)=>x-a[i]), v=c.map((x,i)=>x-a[i]);
    return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  }
  function validateMesh(mesh) {
    const { vertices, faces }=mesh, edges=new Map(), seen=new Set();
    if(!faces.length || vertices.some(p=>p.some(x=>!Number.isFinite(x))) || new Set(vertices.map(p=>p.join(','))).size!==vertices.length) throw new Error('寸法差が小さすぎるか大きすぎるためSTLにできません。寸法を調整してください。');
    let volume=0;
    for(const face of faces) {
      const [a,b,c]=face.map(i=>vertices[i]), n=normal(a,b,c);
      if(!(Math.hypot(...n)>0)) throw new Error('面がつぶれるためSTLにできません。寸法を調整してください。');
      const key=[...face].sort((a,b)=>a-b).join(',');
      if(seen.has(key)) throw new Error('重複面を検出しました。'); seen.add(key);
      volume+=a[0]*(b[1]*c[2]-b[2]*c[1])/6+a[1]*(b[2]*c[0]-b[0]*c[2])/6+a[2]*(b[0]*c[1]-b[1]*c[0])/6;
      face.forEach((a,i)=>{const b=face[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);});
    }
    if([...edges.values()].some(([count,balance])=>count!==2 || balance!==0) || !(volume>0)) throw new Error('閉じたメッシュを生成できませんでした。');
    return { volume, triangles:faces.length };
  }
  function toSTL(mesh) {
    validateMesh(mesh);
    const buffer=new ArrayBuffer(84+50*mesh.faces.length), data=new DataView(buffer);
    new Uint8Array(buffer).set(new TextEncoder().encode('Katachi STL | units: mm | Z up'));
    data.setUint32(80,mesh.faces.length,true);
    let offset=84;
    for(const face of mesh.faces) {
      const points=face.map(i=>mesh.vertices[i]), n=normal(...points), length=Math.hypot(...n);
      for(const value of [...n.map(x=>x/length),...points.flat()]) { data.setFloat32(offset,value,true);offset+=4; }
      data.setUint16(offset,0,true);offset+=2;
    }
    return buffer;
  }
  function filename(type,v,segments) {
    const fields={tray:['cellWidth','cellDepth','columns','rows','divider','wallHeight','outerWall','base'],grid:['cellWidth','cellDepth','columns','rows','divider','wallHeight'],cylinder:['diameter','height'],disk:['diameter','height','hole'],block:['width','depth','height'],box:['width','depth','height','wall','bottom']}[type];
    return `${type}_${fields.map(k=>`${k}-${Number(v[k])}`).join('_')}_mm${type==='disk'||type==='cylinder'?`_fn-${segments}`:''}.stl`;
  }
  const api={createMesh,validateMesh,toSTL,filename};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.ScadMesh=api;
})(typeof globalThis!=='undefined'?globalThis:this);
