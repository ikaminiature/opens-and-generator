(() => {
  const { shapes, generate } = ScadGenerator;
  const $ = id => document.getElementById(id);
  let current = 'cylinder';
  const drafts = Object.fromEntries(Object.entries(shapes).map(([key, s]) => [key, Object.fromEntries(s.fields.map(([id, , value]) => [id, String(value)]))]));
  const descriptions = { cylinder: '丸い柱をつくります。底面は Z = 0 です。', disk: '中心に穴のある円盤。穴の直径を0にすると穴なしになります。', block: '幅・奥行き・高さで、四角いかたまりをつくります。', box: '上面が開いた箱。外寸を保ちながら内側をくり抜きます。' };
  for (const [key, shape] of Object.entries(shapes)) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = shape.name;
    button.dataset.shape = key;
    button.addEventListener('click', () => { current = key; render(); });
    $('shapes').append(button);
  }
  function update() {
    const { code, errors } = generate(current, drafts[current], Number($('segments').value));
    $('code').value = code;
    $('errors').replaceChildren(...errors.map(message => { const p = document.createElement('p'); p.textContent = message; return p; }));
    $('errors').hidden = !errors.length;
    $('copy').disabled = $('save').disabled = $('save-stl').disabled = !!errors.length;
    $('status').textContent = '';
    window.scadPreviewState = { type: current, raw: { ...drafts[current] }, valid: !errors.length, segments: Number($('segments').value) };
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
      const input = document.createElement('input'); input.id = key; input.name = key; input.type = 'number'; input.inputMode = 'decimal'; input.step = 'any'; input.min = '0'; input.required = true; input.value = drafts[current][key]; input.setAttribute('aria-describedby', 'errors');
      input.addEventListener('input', () => { drafts[current][key] = input.value; update(); });
      const unit = document.createElement('span'); unit.textContent = 'mm';
      control.append(input, unit); row.append(caption, control); $('dimensions').append(row);
    }
    update();
  }
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
