(() => {
  const { generate } = ScadGenerator;
  const shapes = { ...ScadGenerator.shapes, fitting: { name: '嵌合パーツ', fields: Fitting.fields }, organizer: { name: '収納トレー・格子', fields: Organizer.fields } };
  let assembled = false;
  const $ = id => document.getElementById(id);
  let current = 'cylinder';
  const drafts = Object.fromEntries(Object.entries(shapes).map(([key, s]) => [key, Object.fromEntries(s.fields.map(([id, , value]) => [id, String(value)]))]));
  const descriptions = { cylinder: '丸い柱をつくります。底面は Z = 0 です。', disk: '中心に穴のある円盤。穴の直径を0にすると穴なしになります。', block: '幅・奥行き・高さで、四角いかたまりをつくります。', box: '上面が開いた箱。外寸を保ちながら内側をくり抜きます。', organizer: 'マスの内寸から仕切りを生成。ケース内寸は各項目を空欄にすると、その方向の判定を省略します。', fitting: 'Aは凸部、Bは止まり穴。クリアランスは直径差です（10 + 0.3 → 穴径10.3 mm）。' };
  for (const [key, shape] of Object.entries(shapes)) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = shape.name;
    button.dataset.shape = key;
    button.addEventListener('click', () => { current = key; render(); });
    $('shapes').append(button);
  }
  function update() {
    const fitting = current === 'fitting';
    const organizer = current === 'organizer';
    const kind = $('organizer-kind').value;
    if (organizer) window.layoutEditor?.prepare(drafts.organizer);
    const result = organizer ? Organizer.generate(drafts[current], kind) : fitting ? Fitting.generate(drafts[current], Number($('segments').value)) : generate(current, drafts[current], Number($('segments').value));
    const { errors } = result;
    window.layoutEditor?.render(organizer, drafts.organizer, kind, result);
    $('organizer-controls').hidden = !organizer;
    $('segments').closest('.field').hidden = organizer;
    $('organizer-summary').hidden = !organizer || !!errors.length;
    if (organizer && !errors.length) {
      const l=result.layout, f=n=>Number(n.toPrecision(8));
      const margin=(k,label)=>result.clearance[k]==null?`${label}：未入力`:`${label}：${f(result.clearance[k])} mm`;
      $('organizer-summary').textContent = `外寸 ${f(l.width)} × ${f(l.depth)} × ${f(l.height)} mm / ${result.count}マス（編集後${result.regions}領域） / ケース：${result.fits}。中央配置時の${margin('Width','左右各側の余白')}、${margin('Depth','前後各側の余白')}、${margin('Height','高さの余裕')}。`;
    }
    if (organizer) for(const key of ['outerWall','base']) $(key)?.closest('.field').toggleAttribute('hidden',kind==='grid');
    const code = fitting ? result[`code${$('output-part').value}`] : result.code;
    $('assembly-controls').hidden = $('part-selection').hidden = $('fitting-downloads').hidden = !fitting;
    $('save').hidden = $('save-stl').hidden = fitting;
    document.querySelectorAll('[data-part]').forEach(b => b.disabled = !!errors.length);
    $('warnings').replaceChildren(...(result.warnings || []).map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    $('warnings').hidden = !(result.warnings || []).length;
    $('fitting-summary').hidden = !fitting || !!errors.length;
    if (fitting && !errors.length) $('fitting-summary').textContent = `凹部直径：${Number((result.values.pinDiameter + result.values.clearance).toPrecision(10))} mm / 穴底の厚さ：${Number((result.values.bThickness - result.values.holeDepth).toPrecision(10))} mm`;
    $('code').value = code;
    $('errors').replaceChildren(...errors.map(message => { const p = document.createElement('p'); p.textContent = message; return p; }));
    $('errors').hidden = !errors.length;
    $('copy').disabled = $('save').disabled = $('save-stl').disabled = !!errors.length;
    $('status').textContent = '';
    window.scadPreviewState = { type: organizer ? kind : current, raw: { ...drafts[current] }, valid: !errors.length, segments: Number($('segments').value), assembled };
    window.dispatchEvent(new Event('scad-preview-update'));
  }
  function render() {
    document.querySelectorAll('[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shape === current)));
    $('description').textContent = descriptions[current];
    $('dimensions').replaceChildren();
    for (const [key, label] of shapes[current].fields) {
      const row = document.createElement('div'); row.className = 'field';
      const caption = document.createElement('label'); caption.htmlFor = key; caption.textContent = label;
      const control = document.createElement('div'); control.className = 'input-wrap';
      const input = document.createElement('input'); input.id = key; input.name = key; input.type = key === 'clearance' ? 'text' : 'number'; input.inputMode = key === 'clearance' ? 'text' : 'decimal'; input.step = 'any'; if (key !== 'clearance') input.min = '0'; input.required = !key.startsWith('case') || key === 'caseGap';
      if (key === 'columns' || key === 'rows') { input.min='1'; input.max='20'; input.step='1'; input.inputMode='numeric'; } input.value = drafts[current][key]; input.setAttribute('aria-describedby', 'errors');
      input.addEventListener('input', () => { drafts[current][key] = input.value; update(); });
      const unit = document.createElement('span'); unit.textContent = key === 'columns' || key === 'rows' ? 'マス' : 'mm';
      control.append(input, unit); row.append(caption, control); $('dimensions').append(row);
    }
    update();
  }
  window.organizerUI = { get: () => ({raw: drafts.organizer, kind: $('organizer-kind').value}), update, render, load: (raw,kind) => { drafts.organizer = raw; $('organizer-kind').value = kind; current = 'organizer'; render(); } };
  $('organizer-kind').addEventListener('change', update);
  $('output-part').addEventListener('change', update);
  document.querySelectorAll('[data-assembly]').forEach(button => button.addEventListener('click', () => {
    assembled = button.dataset.assembly === 'assembled';
    document.querySelectorAll('[data-assembly]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    update();
  }));
  document.querySelectorAll('[data-part]').forEach(button => button.addEventListener('click', () => {
    const segments = Number($('segments').value), result = Fitting.generate(drafts.fitting, segments);
    if (result.errors.length) return;
    const part = button.dataset.part, format = button.dataset.format;
    try {
      const content = format === 'stl' ? ScadMesh.toSTL(ScadMesh.createMesh(`fitting${part}`, result.values, segments)) : result[`code${part}`];
      const blob = new Blob([content], { type: format === 'stl' ? 'model/stl' : 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = Fitting.filename(part, result.values, segments, format);
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      $('status').textContent = `パーツ${part}の保存を開始しました。Safariのダウンロード一覧をご確認ください。`;
    } catch (error) { $('status').textContent = `保存できませんでした。${error.message}`; }
  }));
  $('segments').addEventListener('change', update);
  $('dimensions').addEventListener('submit', e => e.preventDefault());
  $('copy').addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText($('code').value);
      else { $('code').focus(); $('code').select(); $('code').setSelectionRange(0, $('code').value.length); if (!document.execCommand('copy')) throw new Error('copy'); }
      $('status').textContent = 'コードをコピーしました。';
    } catch { $('code').focus(); $('code').select(); $('code').setSelectionRange(0, $('code').value.length); $('status').textContent = 'コピーできませんでした。コードを長押ししてコピーしてください。'; }
  });
  $('save').addEventListener('click', () => {
    const blob = new Blob([$('code').value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${current === 'organizer' ? $('organizer-kind').value : current}.scad`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('status').textContent = '保存を開始しました。Safariのダウンロード一覧をご確認ください。';
  });
  $('save-stl').addEventListener('click', () => {
    try {
      const v = Object.fromEntries(Object.entries(drafts[current]).map(([k, value]) => [k, k === 'edit' ? value : Number(value)]));
      const segments = Number($('segments').value);
      const exportType = current === 'organizer' ? $('organizer-kind').value : current;
      const blob = new Blob([ScadMesh.toSTL(ScadMesh.createMesh(exportType, v, segments))], { type: 'model/stl' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = ScadMesh.filename(exportType, v, segments);
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      $('status').textContent = 'STLの保存を開始しました。Safariのダウンロード一覧、または「ファイル」アプリをご確認ください。';
    } catch (error) { $('status').textContent = `STLを保存できませんでした。${error.message}`; }
  });
  render();
})();
