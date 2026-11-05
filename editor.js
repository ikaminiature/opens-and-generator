(() => {
 const $=id=>document.getElementById(id), clone=Layout.clone, ns='http://www.w3.org/2000/svg';
 let mode='toggle', selected=null, undo=[],redo=[],gesture=null,lastGeometry='';
 const numeric=raw=>Object.fromEntries(Organizer.fields.map(([k])=>[k,Number(raw[k])]));
 const geometry=v=>JSON.stringify([v.columns,v.rows,v.cellWidth,v.cellDepth,v.divider]);
 function prepare(raw){
  const v=numeric(raw);if(![v.columns,v.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=20)||![v.cellWidth,v.cellDepth,v.divider].every(n=>Number.isFinite(n)&&n>0))return;
  if(!raw.edit){raw.edit=Layout.initial(v);lastGeometry=geometry(v);return;}
  if(lastGeometry&&geometry(v)!==lastGeometry){
   const next=Layout.initial(v),old=raw.edit;
   if(old.columns===v.columns&&old.rows===v.rows){
    // 内寸変更時も境界の相対位置を保つ。厚さ制約に合わなければ位置だけ均等に戻す。
    const previous=JSON.parse(lastGeometry),oldTotals=[previous[0]*previous[2]+(previous[0]-1)*previous[4],previous[1]*previous[3]+(previous[1]-1)*previous[4]];
    next.x=old.x.map(p=>p*(v.columns*v.cellWidth+(v.columns-1)*v.divider)/oldTotals[0]);next.y=old.y.map(p=>p*(v.rows*v.cellDepth+(v.rows-1)*v.divider)/oldTotals[1]);
   }
   next.removed=old.removed.filter(key=>{const [a,b,c]=key.split(':');return a==='v'?+b<v.columns-1&&+c<v.rows:+b<v.rows-1&&+c<v.columns;});
   if(!Layout.valid(next,v)){const fresh=Layout.initial(v);next.x=fresh.x;next.y=fresh.y;}
   raw.edit=next;selected=null;
  }
  lastGeometry=geometry(v);
 }
 const snapshot=()=>clone(organizerUI.get());
 function remember(before){undo.push(before);if(undo.length>60)undo.shift();redo=[];}
 function restore(data){lastGeometry='';selected=null;organizerUI.load(clone(data.raw),data.kind);}
 function commit(edit,before=snapshot()){remember(before);organizerUI.get().raw.edit=edit;organizerUI.update();}
 function element(tag,attributes,text){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attributes))e.setAttribute(k,String(v));if(text)e.textContent=text;return e;}
 let drawing=null;
 function render(active,raw,kind,result){
  $('layout-editor').hidden=!active;if(!active)return;
  const v=numeric(raw);if(!raw.edit||!Layout.valid(raw.edit,v)){$('layout-plan').replaceChildren();$('layout-sizes').textContent='寸法を修正すると編集図を表示します。';return;}
  const e=raw.edit,wall=kind==='tray'?v.outerWall:0,W=v.columns*v.cellWidth+(v.columns-1)*v.divider,H=v.rows*v.cellDepth+(v.rows-1)*v.divider;
  if(!Number.isFinite(W+H+wall)||wall<0)return;
  const svg=$('layout-plan'),padding=Math.max(W,H)*0.045,fullW=W+2*wall,fullH=H+2*wall;
  svg.setAttribute('viewBox',`${-padding} ${-padding} ${fullW+2*padding} ${fullH+2*padding}`);svg.replaceChildren();drawing={v,W,H,wall,fullW,fullH};
  const drawingGroup=element('g',{transform:`translate(0 ${fullH}) scale(1 -1)`});svg.append(drawingGroup);
  const ranges=(positions,total)=>{const a=[0,...positions.flatMap(p=>[p,p+v.divider]),total];return Array.from({length:(a.length)/2},(_,i)=>[a[i*2],a[i*2+1]]);};
  const xr=ranges(e.x,W),yr=ranges(e.y,H);
  drawingGroup.append(element('rect',{x:0,y:0,width:fullW,height:fullH,fill:'#f4f7ee',stroke:'#adc2b1','stroke-width':0.3}));
  if(kind==='tray')for(const [x,y,w,h]of [[0,0,fullW,wall],[0,fullH-wall,fullW,wall],[0,0,wall,fullH],[fullW-wall,0,wall,fullH]])drawingGroup.append(element('rect',{x,y,width:w,height:h,fill:'#5d7565'}));
  e.x.forEach((p,c)=>e.y.forEach((q,r)=>{
   if([`v:${c}:${r}`,`v:${c}:${r+1}`,`h:${r}:${c}`,`h:${r}:${c+1}`].some(key=>!e.removed.includes(key)))drawingGroup.append(element('rect',{x:wall+p,y:wall+q,width:v.divider,height:v.divider,fill:'#306d58'}));
  }));
  // 明示的な壁IDは位置と独立しており、将来の壁追加にも利用できる。
  function segment(orientation,index,span,x1,y1,x2,y2){
   const key=`${orientation}:${index}:${span}`,removed=e.removed.includes(key),highlight=selected&&(mode==='toggle'?selected.key===key:selected.axis===(orientation==='v'?'x':'y')&&selected.index===index);
   const g=element('g',{'data-wall':key,role:'button',tabindex:0,'aria-label':`${orientation==='v'?'縦':'横'}境界${index+1} 区間${span+1} ${removed?'削除済み':'あり'}`});
   g.append(element('line',{x1,y1,x2,y2,stroke:highlight?'#cf7f24':removed?'#a7b7a8':'#306d58','stroke-width':removed?Math.min(v.divider,0.7):v.divider,'stroke-dasharray':removed?'2 1':'none'}));
   const hit=Math.max(v.divider,Math.min(W,H)/35);g.append(element('rect',{x:Math.min(x1,x2)-(orientation==='v'?hit/2:0),y:Math.min(y1,y2)-(orientation==='h'?hit/2:0),width:orientation==='v'?hit:x2-x1,height:orientation==='h'?hit:y2-y1,fill:'transparent','pointer-events':'all'}));
   g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selected={axis:orientation==='v'?'x':'y',index,key};if(mode==='toggle')commit(Layout.toggle(e,key));else organizerUI.update();}});drawingGroup.append(g);
  }
  e.x.forEach((p,i)=>yr.forEach(([a,b],j)=>segment('v',i,j,wall+p+v.divider/2,wall+a,wall+p+v.divider/2,wall+b)));
  e.y.forEach((p,i)=>xr.forEach(([a,b],j)=>segment('h',i,j,wall+a,wall+p+v.divider/2,wall+b,wall+p+v.divider/2)));
  // 各行・列の内寸。削除した境界をまたぐ領域は結合した空間になる。
  const fmt=n=>Number(n.toFixed(3));
  $('layout-sizes').textContent=`列の内寸：${xr.map(([a,b])=>fmt(b-a)).join(' / ')} mm。行の内寸：${yr.map(([a,b])=>fmt(b-a)).join(' / ')} mm。`;
  $('layout-position').disabled=$('layout-apply').disabled=!selected||mode!=='move';
  if(document.activeElement!==$('layout-position'))$('layout-position').value=selected?fmt(e[selected.axis][selected.index]):'';
  $('layout-undo').disabled=!undo.length;$('layout-redo').disabled=!redo.length;
  document.querySelectorAll('[data-edit-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.editMode===mode)));
 }
 window.layoutEditor={prepare,render};
 const svg=$('layout-plan');
 svg.addEventListener('pointerdown',event=>{
  if(gesture||event.button>0)return;const target=event.target.closest('[data-wall]');if(!target||!drawing)return;
  const [o,index]=target.dataset.wall.split(':');selected={axis:o==='v'?'x':'y',index:Number(index),key:target.dataset.wall};
  gesture={id:event.pointerId,key:target.dataset.wall,startX:event.clientX,startY:event.clientY,before:snapshot(),edit:clone(organizerUI.get().raw.edit),selected:{...selected}};
  svg.setPointerCapture(event.pointerId);event.preventDefault();organizerUI.update();
 });
 svg.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId||mode!=='move'||!drawing)return;
  const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const axis=gesture.selected.axis,p=(axis==='x'?point.x:drawing.fullH-point.y)-drawing.wall-drawing.v.divider/2;
  organizerUI.get().raw.edit=Layout.move(gesture.edit,drawing.v,axis,gesture.selected.index,p);organizerUI.update();
 });
 function finish(event,cancel=false){
  if(!gesture||event.pointerId!==gesture.id)return;const g=gesture;gesture=null;
  if(cancel){organizerUI.get().raw.edit=g.edit;organizerUI.update();return;}
  if(mode==='toggle'&&Math.hypot(event.clientX-g.startX,event.clientY-g.startY)<12)commit(Layout.toggle(g.edit,g.key),g.before);
  else if(mode==='move'&&JSON.stringify(g.edit)!==JSON.stringify(organizerUI.get().raw.edit)){remember(g.before);organizerUI.update();}
 }
 svg.addEventListener('pointerup',e=>finish(e));svg.addEventListener('pointercancel',e=>finish(e,true));
 document.querySelectorAll('[data-edit-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.editMode;organizerUI.update();}));
 $('layout-apply').addEventListener('click',()=>{
  if(!selected||!drawing)return;const value=Number($('layout-position').value);
  if($('layout-position').value.trim()===''||!Number.isFinite(value)){$('layout-status').textContent='位置はmmの数値で入力してください。';return;}
  const e=Layout.move(organizerUI.get().raw.edit,drawing.v,selected.axis,selected.index,value);commit(e);
  $('layout-status').textContent=Math.abs(e[selected.axis][selected.index]-value)>1e-6?'最小内寸と壁厚を保てる位置に制限しました。':'位置を更新しました。';
 });
 $('layout-undo').addEventListener('click',()=>{if(undo.length){redo.push(snapshot());restore(undo.pop());}});
 $('layout-redo').addEventListener('click',()=>{if(redo.length){undo.push(snapshot());restore(redo.pop());}});
 $('layout-reset').addEventListener('click',()=>{if(drawing)commit(Layout.initial(drawing.v));});
 function documentData(){const data=snapshot();return {format:'katachi-layout',version:1,...data};}
 function load(data){
  if(!data||data.format!=='katachi-layout'||data.version!==1||!['tray','grid'].includes(data.kind)||!data.raw||!data.raw.edit)throw new Error('対応するレイアウトJSONではありません。');
  // 未知のキーは引き継がない。
  const raw=Object.fromEntries(Organizer.fields.map(([k])=>[k,data.raw[k]]));raw.edit=data.raw.edit;
  if(Organizer.fields.some(([k])=>raw[k]!=null&&!['number','string'].includes(typeof raw[k])))throw new Error('寸法の形式が不正です。');
  const result=Organizer.generate(raw,data.kind);if(result.errors.length&&!result.errors.every(e=>e.includes('すべての仕切り')))throw new Error(result.errors.join(' '));
  remember(snapshot());restore({raw,kind:data.kind});$('layout-status').textContent='レイアウトを読み込みました。';
 }
 $('layout-store').addEventListener('click',()=>{try{localStorage.setItem('katachi-layout-v1',JSON.stringify(documentData()));$('layout-status').textContent='このブラウザに保存しました。再開時は「保存を復元」を押してください。';}catch{$('layout-status').textContent='保存できません。JSON保存をお使いください。';}});
 $('layout-restore').addEventListener('click',()=>{try{const data=localStorage.getItem('katachi-layout-v1');if(!data)throw new Error('保存データがありません。');load(JSON.parse(data));}catch(e){$('layout-status').textContent=e.message;}});
 $('layout-json').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(documentData(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='katachi-layout.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);});
 $('layout-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>100000)throw new Error('JSONファイルが大きすぎます（100KBまで）。');load(JSON.parse(await file.text()));}catch(e){$('layout-status').textContent=`読み込めませんでした。${e.message}`;}event.target.value='';});
 organizerUI.update();
})();
