(function(root){
 const fields=[['cellWidth','マスの内寸幅',30],['cellDepth','マスの内寸奥行き',30],['columns','横方向のマス数',3],['rows','縦方向のマス数',2],['divider','仕切りの厚さ',2],['wallHeight','仕切りの高さ（底板上から）',25],['outerWall','外周壁の厚さ',2],['base','底板の厚さ',2],['caseWidth','ケース内寸幅（任意）',''],['caseDepth','ケース内寸奥行き（任意）',''],['caseHeight','ケース内寸高さ（任意）',''],['caseGap','ケースとのクリアランス（各側）',0.5],['printWidth','造形範囲の幅',180],['printDepth','造形範囲の奥行き',180],['printHeight','造形範囲の高さ',180]];
 function layout(v,kind){
  const tray=kind==='tray',wall=tray?v.outerWall:0;
  function axis(cell,count){const a=[0];if(tray)a.push(wall);for(let i=0;i<count;i++){a.push(a.at(-1)+cell);if(i<count-1)a.push(a.at(-1)+v.divider);}if(tray)a.push(a.at(-1)+wall);return a;}
  const x=axis(v.cellWidth,v.columns),y=axis(v.cellDepth,v.rows);
  const isWall=(i,a)=>tray?(i===0||i===a.length-2||i%2===0):i%2===1;
  const occupied=(i,j)=>isWall(i,x)||isWall(j,y);
  const cells=[];for(let i=0;i<x.length-1;i++)for(let j=0;j<y.length-1;j++)if(occupied(i,j))cells.push([i,j]);
  const minX=tray?0:Math.min(...cells.map(([i])=>x[i])), minY=tray?0:Math.min(...cells.map(([,j])=>y[j]));
  const maxX=tray?x.at(-1):Math.max(...cells.map(([i])=>x[i+1])),maxY=tray?y.at(-1):Math.max(...cells.map(([,j])=>y[j+1]));
  return {x,y,occupied,minX,minY,width:maxX-minX,depth:maxY-minY,height:v.wallHeight+(tray?v.base:0)};
 }
 function generate(raw,kind='tray'){
  const v={},errors=[],warnings=[];
  for(const [key,label]of fields){
   const optional=key.startsWith('case')&&key!=='caseGap',unused=kind==='grid'&&(key==='outerWall'||key==='base');
   if(optional&&(raw[key]==null||String(raw[key]).trim()==='')){v[key]=null;continue;}
   const n=Number(raw[key]);v[key]=n;
   if(unused)continue;
   if(raw[key]==null||String(raw[key]).trim()===''||!Number.isFinite(n)||(key==='caseGap'?n<0:n<=0))errors.push(`${label}は${key==='caseGap'?'0以上':'0より大きい'}の数値で入力してください。`);
   if((key==='columns'||key==='rows')&&(!Number.isInteger(n)||n<1||n>20))errors.push(`${label}は1〜20の整数で入力してください。`);
  }
  if(kind!=='tray'&&kind!=='grid')errors.push('種類を選択してください。');
  if(kind==='grid'&&v.columns===1&&v.rows===1)errors.push('1×1には内部仕切りがありません。格子仕切りでは少なくとも一方向を2以上にしてください。');
  if(errors.length)return {values:v,errors,warnings,code:''};
  const l=layout(v,kind),count=v.columns*v.rows,margin={},clearance={};
  const axes=[l.x.map(n=>Math.fround(n-l.minX)),l.y.map(n=>Math.fround(n-l.minY)),kind==='tray'?[0,Math.fround(v.base),Math.fround(l.height)]:[0,Math.fround(l.height)]];
  if(axes.some(a=>a.some((n,i)=>!Number.isFinite(n)||(i>0&&n<=a[i-1]))))return {values:v,errors:['寸法が大きすぎるか、厚さが小さすぎてSTLで再現できません。寸法を調整してください。'],warnings,code:''};
  for(const [key,size,label]of [['Width',l.width,'幅'],['Depth',l.depth,'奥行き'],['Height',l.height,'高さ']]){
   if(size>v['print'+key]+1e-9)warnings.push(`${label}がプリンターの造形範囲を超えています（自動分割はしません）。`);
   if(v['case'+key]!=null){
    margin[key]=v['case'+key]-size;
    clearance[key]=key==='Height'?margin[key]:margin[key]/2;
    if(margin[key]<-1e-9)warnings.push(`${label}がケース内寸を超えています。`);
    else if(key!=='Height'&&clearance[key]+1e-9<v.caseGap)warnings.push(`${label}方向の各側の隙間が指定クリアランスに足りません。`);
   }
  }
  if(kind==='grid'&&(v.columns===1||v.rows===1))warnings.push('一方向が1マスのため平行な仕切りのみです。複数本はつながらない独立部品になります。外寸は材料がある範囲です。');
  const fits=Object.values(margin).some(n=>n< -1e-9)?'収まりません':Object.entries(clearance).some(([k,n])=>k!=='Height'&&n+1e-9<v.caseGap)?'クリアランス不足':Object.keys(margin).length===3?'収まります':'未入力の方向は未判定';
  const cubes=[];const cube=(x,y,z,w,d,h)=>cubes.push(`  translate([${x-l.minX}, ${y-l.minY}, ${z}]) cube([${w}, ${d}, ${h}]);`);
  let body;
  if(kind==='tray'){
   for(let i=0;i<v.columns;i++)for(let j=0;j<v.rows;j++)cube(v.outerWall+i*(v.cellWidth+v.divider),v.outerWall+j*(v.cellDepth+v.divider),v.base,v.cellWidth,v.cellDepth,v.wallHeight+0.01);
   body=`difference() {\n  cube([${l.width}, ${l.depth}, ${l.height}]);\n${cubes.join('\n')}\n}`;
  }else{
   // 交差部分は重なった角柱のunion。面だけの接合に頼らない。
   for(let i=1;i<v.columns;i++)cube(i*v.cellWidth+(i-1)*v.divider,0,0,v.divider,l.y.at(-1),v.wallHeight);
   for(let j=1;j<v.rows;j++)cube(0,j*v.cellDepth+(j-1)*v.divider,0,l.x.at(-1),v.divider,v.wallHeight);
   body=`union() {\n${cubes.join('\n')}\n}`;
  }
  return {values:v,errors,warnings,layout:l,count,clearance,fits,code:`// ${kind==='tray'?'収納トレー':'格子仕切り'} / 単位:mm\n${body}\n`};
 }
 function createMesh(v,kind){
  const l=layout(v,kind),z=kind==='tray'?[0,v.base,l.height]:[0,l.height],vertices=[],faces=[],ids=new Map();
  function id(i,j,k){const key=[i,j,k].join(',');if(!ids.has(key)){ids.set(key,vertices.length);vertices.push([l.x[i]-l.minX,l.y[j]-l.minY,z[k]].map(Math.fround));}return ids.get(key);}
  const filled=(i,j,k)=>i>=0&&i<l.x.length-1&&j>=0&&j<l.y.length-1&&k>=0&&k<z.length-1&&((kind==='tray'&&k===0)||l.occupied(i,j));
  function quad(points){const [a,b,c,d]=points.map(p=>id(...p));faces.push([a,b,c],[a,c,d]);}
  for(let i=0;i<l.x.length-1;i++)for(let j=0;j<l.y.length-1;j++)for(let k=0;k<z.length-1;k++)if(filled(i,j,k)){
   if(!filled(i-1,j,k))quad([[i,j,k],[i,j,k+1],[i,j+1,k+1],[i,j+1,k]]);
   if(!filled(i+1,j,k))quad([[i+1,j,k],[i+1,j+1,k],[i+1,j+1,k+1],[i+1,j,k+1]]);
   if(!filled(i,j-1,k))quad([[i,j,k],[i+1,j,k],[i+1,j,k+1],[i,j,k+1]]);
   if(!filled(i,j+1,k))quad([[i,j+1,k],[i,j+1,k+1],[i+1,j+1,k+1],[i+1,j+1,k]]);
   if(!filled(i,j,k-1))quad([[i,j,k],[i,j+1,k],[i+1,j+1,k],[i+1,j,k]]);
   if(!filled(i,j,k+1))quad([[i,j,k+1],[i+1,j,k+1],[i+1,j+1,k+1],[i,j+1,k+1]]);
  }
  return {vertices,faces};
 }
 const api={fields,layout,generate,createMesh};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Organizer=api;
})(typeof globalThis!=='undefined'?globalThis:this);
