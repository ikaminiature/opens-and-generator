(() => {
  const { generate } = ScadGenerator;
  const shapes = { ...ScadGenerator.shapes, fitting: { name: '嵌合パーツ', fields: Fitting.fields } };
  let assembled = false;
  const $ = id => document.getElementById(id);
  let current = 'cylinder';
  const drafts = Object.fromEntries(Object.entries(shapes).map(([key, s]) => [key, Object.fromEntries(s.fields.map(([id, , value]) => [id, String(value)]))]));
  const descriptions = { cylinder: '丸い柱をつくります。底面は Z = 0 です。', disk: '中心に穴のある円盤。穴の直径を0にすると穴なしになります。', block: '幅・奥行き・高さで、四角いかたまりをつくります。', box: '上面が開いた箱。外寸を保ちながら内側をくり抜きます。', fitting: 'Aは凸部、Bは止まり穴。クリアランスは直径差です（10 + 0.3 → 穴径10.3 mm）。' };
  for (const [key, shape] of Object.entries(shapes)) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = shape.name;
    button.dataset.shape = key;
    button.addEventListener('click', () => { current = key; render(); });
    $('shapes').append(button);
  }
  function update() {
    const fitting = current === 'fitting';
    const result = fitting ? Fitting.generate(drafts[current], Number($('segments').value)) : generate(current, drafts[current], Number($('segments').value));
    const { errors } = result;
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
    window.scadPreviewState = { type: current, raw: { ...drafts[current] }, valid: !errors.length, segments: Number($('segments').value), assembled };
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
      const input = document.createElement('input'); input.id = key; input.name = key; input.type = key === 'clearance' ? 'text' : 'number'; input.inputMode = key === 'clearance' ? 'text' : 'decimal'; input.step = 'any'; if (key !== 'clearance') input.min = '0'; input.required = true; input.value = drafts[current][key]; input.setAttribute('aria-describedby', 'errors');
      input.addEventListener('input', () => { drafts[current][key] = input.value; update(); });
      const unit = document.createElement('span'); unit.textContent = 'mm';
      control.append(input, unit); row.append(caption, control); $('dimensions').append(row);
    }
    update();
  }
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
    link.href = url; link.download = `${current}.scad`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('status').textContent = '保存を開始しました。Safariのダウンロード一覧をご確認ください。';
  });
  $('save-stl').addEventListener('click', () => {
    try {
      const v = Object.fromEntries(Object.entries(drafts[current]).map(([k, value]) => [k, Number(value)]));
      const segments = Number($('segments').value);
      const blob = new Blob([ScadMesh.toSTL(ScadMesh.createMesh(current, v, segments))], { type: 'model/stl' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = ScadMesh.filename(current, v, segments);
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      $('status').textContent = 'STLの保存を開始しました。Safariのダウンロード一覧、または「ファイル」アプリをご確認ください。';
    } catch (error) { $('status').textContent = `STLを保存できませんでした。${error.message}`; }
  });
  render();
})();
