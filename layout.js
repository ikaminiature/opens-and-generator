(function(root){
 const clone=x=>JSON.parse(JSON.stringify(x));
 const minimum=1; // 移動操作で確保する最小内寸mm（初期寸法が小さい場合はその値）
 function initial(v){return {version:1,columns:v.columns,rows:v.rows,x:Array.from({length:v.columns-1},(_,i)=>(i+1)*v.cellWidth+i*v.divider),y:Array.from({length:v.rows-1},(_,i)=>(i+1)*v.cellDepth+i*v.divider),removed:[]};}
 function valid(e,v){
  if(!e||e.version!==1||e.columns!==v.columns||e.rows!==v.rows||!Array.isArray(e.removed)||e.removed.length>800) return false;
  for(const [axis,count,cell]of [['x',v.columns,v.cellWidth],['y',v.rows,v.cellDepth]]){
   const a=e[axis],total=count*cell+(count-1)*v.divider,min=Math.min(minimum,cell);if(!Array.isArray(a)||a.length!==count-1)return false;
   let end=0;for(const p of a){if(!Number.isFinite(p)||p-end<min-1e-8)return false;end=p+v.divider;}if(total-end<min-1e-8)return false;
  }
  return new Set(e.removed).size===e.removed.length&&e.removed.every(key=>{if(typeof key!=='string')return false;const m=/^([vh]):(\d+):(\d+)$/.exec(key);return m&&(m[1]==='v'?+m[2]<v.columns-1&&+m[3]<v.rows:+m[2]<v.rows-1&&+m[3]<v.columns);});
 }
 function move(e,v,axis,index,position){
  const next=clone(e),cell=axis==='x'?v.cellWidth:v.cellDepth,count=axis==='x'?v.columns:v.rows,a=next[axis],min=Math.min(minimum,cell);
  const low=index===0?min:a[index-1]+v.divider+min,high=index===a.length-1?count*cell+(count-1)*v.divider-v.divider-min:a[index+1]-v.divider-min;
  a[index]=Math.max(low,Math.min(high,position));return next;
 }
 function toggle(e,key){const next=clone(e);next.removed=next.removed.includes(key)?next.removed.filter(k=>k!==key):[...next.removed,key];return next;}
 function regions(e){
  const removed=new Set(e.removed),seen=new Set();let count=0;
  for(let x=0;x<e.columns;x++)for(let y=0;y<e.rows;y++)if(!seen.has(`${x},${y}`)){
   count++;const queue=[[x,y]];seen.add(`${x},${y}`);
   for(let i=0;i<queue.length;i++){const [a,b]=queue[i];for(const [c,d,key]of [[a-1,b,`v:${a-1}:${b}`],[a+1,b,`v:${a}:${b}`],[a,b-1,`h:${b-1}:${a}`],[a,b+1,`h:${b}:${a}`]])if(c>=0&&d>=0&&c<e.columns&&d<e.rows&&removed.has(key)&&!seen.has(`${c},${d}`)){seen.add(`${c},${d}`);queue.push([c,d]);}}
  }
  return count;
 }
 const api={initial,valid,move,toggle,regions,clone};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Layout=api;
})(typeof globalThis!=='undefined'?globalThis:this);
