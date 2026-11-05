(function(root){
 const L=typeof module!=='undefined'&&module.exports?require('./layout'):root.Layout;
 const fields=[['cellWidth','マスの内寸幅',30],['cellDepth','マスの内寸奥行き',30],['columns','横方向のマス数',3],['rows','縦方向のマス数',2],['divider','仕切りの厚さ',2],['wallHeight','仕切りの高さ（底板上から）',25],['outerWall','外周壁の厚さ',2],['base','底板の厚さ',2],['caseWidth','ケース内寸幅（任意）',''],['caseDepth','ケース内寸奥行き（任意）',''],['caseHeight','ケース内寸高さ（任意）',''],['caseGap','ケースとのクリアランス（各側）',0.5],['printWidth','造形範囲の幅',180],['printDepth','造形範囲の奥行き',180],['printHeight','造形範囲の高さ',180]];
 function layout(v,kind){
  const tray=kind==='tray',wall=tray?v.outerWall:0;
  const edit=v.edit||L.initial(v);
  function axis(cell,count,positions){const a=[0];if(tray)a.push(wall);for(const p of positions)a.push(wall+p,wall+p+v.divider);a.push(wall+count*cell+(count-1)*v.divider);if(tray)a.push(a.at(-1)+wall);return a;}
  const x=axis(v.cellWidth,v.columns,edit.x),y=axis(v.cellDepth,v.rows,edit.y),removed=new Set(edit.removed);
  const segment=(orientation,boundary,span)=>!removed.has(`${orientation}:${boundary}:${span}`);
  const occupied=(i,j)=>{
   if(tray&&(i===0||j===0||i===x.length-2||j===y.length-2))return true;
   const a=i-(tray?1:0),b=j-(tray?1:0),vx=a%2===1,hy=b%2===1;
   if(vx&&hy){const c=(a-1)/2,r=(b-1)/2;return segment('v',c,r)||segment('v',c,r+1)||segment('h',r,c)||segment('h',r,c+1);}
   if(vx)return segment('v',(a-1)/2,b/2);
   if(hy)return segment('h',(b-1)/2,a/2);
   return false;
  };
  const cells=[];for(let i=0;i<x.length-1;i++)for(let j=0;j<y.length-1;j++)if(occupied(i,j))cells.push([i,j]);
  const minX=tray?0:Math.min(...cells.map(([i])=>x[i])), minY=tray?0:Math.min(...cells.map(([,j])=>y[j]));
  const maxX=tray?x.at(-1):Math.max(...cells.map(([i])=>x[i+1])),maxY=tray?y.at(-1):Math.max(...cells.map(([,j])=>y[j+1]));
  return {x,y,occupied,empty:!cells.length,minX,minY,width:maxX-minX,depth:maxY-minY,height:v.wallHeight+(tray?v.base:0)};
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
  if(raw.edit!=null){if(!L.valid(raw.edit,v))errors.push('編集レイアウトの位置・寸法・形式が不正です。均等配置にリセットしてください。');else v.edit=L.clone(raw.edit);}
  if(errors.length)return {values:v,errors,warnings,code:''};
  const l=layout(v,kind),count=v.columns*v.rows,margin={},clearance={};
  if(l.empty)return {values:v,errors:['すべての仕切りが削除されています。壁を復元してください。'],warnings,code:''};
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
  // 連結していない仕切りを検出（底板による接続は除外）。
  const seen=new Set();let components=0,isolated=0;
  for(let i=0;i<l.x.length-1;i++)for(let j=0;j<l.y.length-1;j++)if(l.occupied(i,j)&&!seen.has(`${i},${j}`)){
   components++;let touches=false;const queue=[[i,j]];seen.add(`${i},${j}`);
   for(let q=0;q<queue.length;q++){const [a,b]=queue[q];if(a===0||b===0||a===l.x.length-2||b===l.y.length-2)touches=true;
    for(const [c,d]of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]])if(c>=0&&d>=0&&c<l.x.length-1&&d<l.y.length-1&&l.occupied(c,d)&&!seen.has(`${c},${d}`)){seen.add(`${c},${d}`);queue.push([c,d]);}}
   if(!touches)isolated++;
  }
  if((kind==='tray'&&isolated)||(kind==='grid'&&components>1))warnings.push('孤立した仕切りがあります。トレーでは底板で支えられますが、格子では独立した部品になります。');
  const cubes=[];const cube=(x,y,z,w,d,h)=>cubes.push(`  translate([${x-l.minX}, ${y-l.minY}, ${z}]) cube([${w}, ${d}, ${h}]);`);
  if(kind==='tray')cube(0,0,0,l.width,l.depth,v.base);
  for(let j=0;j<l.y.length-1;j++)for(let i=0;i<l.x.length-1;i++)if(l.occupied(i,j)){
   const start=i;while(i+1<l.x.length-1&&l.occupied(i+1,j))i++;
   cube(l.x[start],l.y[j],0,l.x[i+1]-l.x[start],l.y[j+1]-l.y[j],l.height);
  }
  const body=`union() {\n${cubes.join('\n')}\n}`;
  return {values:v,errors,warnings,layout:l,count,regions:L.regions(v.edit||L.initial(v)),clearance,fits,code:`// ${kind==='tray'?'収納トレー':'格子仕切り'} / 単位:mm\n${body}\n`};
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
