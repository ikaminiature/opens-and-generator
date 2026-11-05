(function(root) {
  const fields = [
    ['aDiameter','Aのベース直径',30], ['aThickness','Aのベース厚さ',3],
    ['bDiameter','Bのベース直径',30], ['bThickness','Bのベース厚さ',8],
    ['pinDiameter','凸部の直径',10], ['pinHeight','凸部の高さ',5],
    ['holeDepth','凹部の深さ',5.5], ['clearance','嵌合クリアランス（直径差）',0.3],
    ['minBottom','穴底に残す最小厚さ',2]
  ];
  function generate(raw, segments=96) {
    const values={}, errors=[], warnings=[];
    for(const [key,label] of fields) {
      const n=Number(raw[key]); values[key]=n;
      if(raw[key]==null || String(raw[key]).trim()==='' || !Number.isFinite(n) || (key!=='clearance'&&n<=0)) errors.push(`${label}は${key==='clearance'?'有限の':'0より大きい'}数値で入力してください。`);
    }
    if(!Number.isInteger(segments)||segments<12||segments>384||segments%4) errors.push('円の分割数は12〜384の4の倍数にしてください。');
    const v=values;
    if(!errors.length) {
      if(v.pinDiameter>=v.aDiameter) errors.push('凸部の直径はAのベース直径より小さくしてください。');
      if(v.pinDiameter+v.clearance<=0 || v.pinDiameter+v.clearance>=v.bDiameter) errors.push('凹部の直径（凸部直径＋クリアランス）は0より大きく、Bのベース直径より小さくしてください。');
      if(v.holeDepth>=v.bThickness || v.bThickness-v.holeDepth+1e-12*Math.max(v.bThickness,v.minBottom)<v.minBottom) errors.push('凹部の深さを減らすかBを厚くして、穴底に指定した最小厚さを残してください。');
      if(v.pinHeight>v.holeDepth) warnings.push(`凸部が凹部より${Number((v.pinHeight-v.holeDepth).toPrecision(8))} mm長いため、完全には差し込めません。組み立て表示ではその分の隙間を残します。`);
      if(v.clearance<=0) warnings.push('クリアランスがゼロまたは負数のため、干渉して差し込めない可能性があります。組み立て表示は位置関係の確認用です。');
    }
    const header=part=>`// 嵌合パーツ${part} / 単位: mm\n$fn = ${segments};\n\n`;
    const codeA=header('A')+`union() {\n  cylinder(d = ${v.aDiameter}, h = ${v.aThickness});\n  translate([0, 0, ${v.aThickness} / 2])\n    cylinder(d = ${v.pinDiameter}, h = ${v.pinHeight} + ${v.aThickness} / 2);\n}\n`;
    const codeB=header('B')+`difference() {\n  cylinder(d = ${v.bDiameter}, h = ${v.bThickness});\n  translate([0, 0, ${v.bThickness} - ${v.holeDepth}])\n    cylinder(d = ${v.pinDiameter} + (${v.clearance}), h = ${v.holeDepth} + 0.01);\n}\n`;
    return {values,errors,warnings,codeA:errors.length?'':codeA,codeB:errors.length?'':codeB};
  }
  function placement(v,assembled) {
    if(assembled) return {a:[0,0,v.aThickness+v.bThickness+Math.max(0,v.pinHeight-v.holeDepth)],b:[0,0,0],flip:true};
    const distance=(v.aDiameter+v.bDiameter)/2+Math.max(v.aDiameter,v.bDiameter)*0.15;
    return {a:[-distance/2,0,0],b:[distance/2,0,0],flip:false};
  }
  function filename(part,v,segments,extension) {
    const keys=part==='A'?['aDiameter','aThickness','pinDiameter','pinHeight']:['bDiameter','bThickness','pinDiameter','clearance','holeDepth','minBottom'];
    return `fitting-${part}_${keys.map(k=>`${k}-${v[k]}`).join('_')}_mm_fn-${segments}.${extension}`;
  }
  const api={fields,generate,placement,filename};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;else root.Fitting=api;
})(typeof globalThis!=='undefined'?globalThis:this);
